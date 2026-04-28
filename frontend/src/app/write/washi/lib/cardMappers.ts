// ============================================================
// lib/cardMappers.ts — 结果映射到 WorkCard
// Standup Workspace v3.0
// ============================================================

import type { WorkCard, WriteIntent, WorkCardType } from "../types";
import type { StreamingMeta } from "@/hooks/useStreamingTask";

// ─── 步骤标签映射 ────────────────────────────────────────────

const CARD_TITLE_MAP: Record<string, string> = {
  premise: "前提卡",
  joke_to_premise: "梗反推前提",
  angles: "角度卡",
  rewrite: "改稿卡",
  feedback: "演后复盘",
  material: "素材卡",
  draft: "初稿卡",
  angle: "角度卡",
};

const CARD_KICKER_MAP: Record<string, string> = {
  premise: "PREMISE",
  joke_to_premise: "JOKE → PREMISE",
  angles: "ANGLES",
  rewrite: "REWRITE",
  feedback: "PERFORMANCE REVIEW",
  material: "MATERIAL",
  draft: "DRAFT",
  angle: "ANGLES",
};

// ─── 结果映射 ────────────────────────────────────────────────

export function mapResultToCard(input: {
  sessionId: string;
  intent: WriteIntent;
  result: unknown;
  tokens: string;
  meta?: StreamingMeta;
}): WorkCard {
  const { sessionId, intent, result, tokens, meta } = input;

  const base = {
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant" as const,
    rawData: result,
    sourcePath: [intent.type] as string[],
    createdAt: Date.now(),
    meta: {
      endpoint: intent.endpoint,
      model: meta?.selected_model,
      provider: meta?.provider,
      latencyMs: meta?.total_latency_ms,
      requestId: meta?.request_id,
      attemptCount: meta?.attempt_count,
    },
  };

  const type: WorkCardType =
    intent.type === "angles" ? "angle" :
    intent.type === "feedback" ? "feedback" :
    (intent.type as WorkCardType);

  const title = CARD_TITLE_MAP[intent.type] ?? "生成卡";
  const kicker = CARD_KICKER_MAP[intent.type] ?? intent.type.toUpperCase();
  const content = extractContent(intent.type, result, tokens);
  const actions = buildActions(intent.type, content);

  return {
    ...base,
    type,
    title,
    content,
    actions,
  };
}

// ─── 内容提取 ────────────────────────────────────────────────

function extractContent(
  intentType: string,
  result: unknown,
  fallback: string
): string {
  const r = (result ?? {}) as Record<string, unknown>;

  switch (intentType) {
    case "premise":
    case "joke_to_premise": {
      const premise =
        (r.premise as string | undefined) ??
        (r.core_premise as string | undefined) ??
        ((r.result as Record<string, unknown>)?.premise as string | undefined) ??
        ((r.result as Record<string, unknown>)?.core_premise as string | undefined) ??
        fallback;
      return premise;
    }

    case "angles": {
      const angles = r.angles ?? (r.result as Record<string, unknown>)?.angles ?? r.items;
      if (Array.isArray(angles)) {
        return angles
          .map((item, idx) => {
            if (typeof item === "string") return `${idx + 1}. ${item}`;
            const title = (item as Record<string, unknown>).title ?? "";
            const desc =
              (item as Record<string, unknown>).description ??
              (item as Record<string, unknown>).content ?? "";
            return `${idx + 1}. ${title}${title && desc ? " — " : ""}${desc}`;
          })
          .join("\n");
      }
      return fallback;
    }

    case "rewrite": {
      const script =
        (r.improved_script as string | undefined) ??
        ((r.result as Record<string, unknown>)?.improved_script as string | undefined) ??
        (r.script as string | undefined) ??
        ((r.result as Record<string, unknown>)?.script as string | undefined) ??
        ((r.result as Record<string, unknown>)?.improved as string | undefined) ??
        fallback;
      return script;
    }

    case "feedback": {
      const analysis =
        (r.analysis as string | undefined) ??
        ((r.result as Record<string, unknown>)?.analysis as string | undefined) ??
        (r.suggestions as string | undefined) ??
        ((r.result as Record<string, unknown>)?.suggestions as string | undefined) ??
        fallback;
      return analysis;
    }

    default:
      return fallback;
  }
}

// ─── 动作按钮 ────────────────────────────────────────────────

function buildActions(
  intentType: string,
  _content: string
): WorkCard["actions"] {
  switch (intentType) {
    case "premise":
      return [
        { id: "find_angles", type: "find_angles", label: "找角度", nextIntent: "angles" },
        { id: "expand_to_draft", type: "expand_to_draft", label: "扩成草稿", nextIntent: "rewrite" },
        { id: "make_sharper", type: "make_sharper", label: "更毒舌", nextIntent: "rewrite" },
      ];

    case "joke_to_premise":
      return [
        { id: "find_angles", type: "find_angles", label: "继续找角度", nextIntent: "angles" },
        { id: "make_sharper", type: "make_sharper", label: "更毒舌", nextIntent: "rewrite" },
        { id: "make_softer", type: "make_softer", label: "更克制", nextIntent: "rewrite" },
      ];

    case "angles":
      return [
        { id: "expand_to_draft", type: "expand_to_draft", label: "扩成草稿", nextIntent: "rewrite" },
        { id: "find_more", type: "find_angles", label: "再找 5 个", nextIntent: "angles" },
      ];

    case "rewrite":
      return [
        { id: "make_sharper", type: "make_sharper", label: "更毒舌", nextIntent: "rewrite" },
        { id: "make_softer", type: "make_softer", label: "更克制", nextIntent: "rewrite" },
        { id: "continue", type: "continue", label: "继续改稿", nextIntent: "rewrite" },
      ];

    case "feedback":
      return [
        { id: "rewrite", type: "rewrite", label: "生成下一版", nextIntent: "rewrite" },
        { id: "save", type: "save", label: "保存记录", nextIntent: undefined },
      ];

    default:
      return [];
  }
}

// ─── 错误卡片 ────────────────────────────────────────────────

export function mapErrorToCard(input: {
  sessionId: string;
  error: string;
  errorCode?: string;
  meta?: StreamingMeta;
}): WorkCard {
  const { sessionId, error, errorCode, meta } = input;

  let message = error;
  if (errorCode === "TIMEOUT") {
    message = "这次生成超时了，但你的输入已保留。可以缩短文本后重试。";
  } else if (errorCode === "NETWORK") {
    message = "网络连接中断了。请检查网络后重试。";
  } else if (errorCode === "INVALID_RESPONSE") {
    message = "模型返回格式不完整。建议重试一次，或换一个更短的输入。";
  }

  return {
    id: crypto.randomUUID(),
    sessionId,
    type: "error",
    role: "system",
    title: "生成失败",
    content: message,
    sourcePath: ["error"],
    createdAt: Date.now(),
    meta: {
      model: meta?.selected_model,
      provider: meta?.provider,
      latencyMs: meta?.total_latency_ms,
      requestId: meta?.request_id,
      attemptCount: meta?.attempt_count,
    },
  };
}
