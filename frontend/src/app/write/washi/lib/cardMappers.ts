// ============================================================
// lib/cardMappers.ts — 结果映射到 WorkCard
// Standup Workspace v3.0
// ============================================================

import type { WorkCard, WriteIntent, WorkCardType } from "../types";
import type { StreamingMeta } from "@/hooks/useStreamingTask";

// Re-export so callers don't need an extra import
export { buildSourcePath } from "../types";

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

export interface CardMappingContext {
  /** The card that triggered this generation (user or assistant source). */
  parentCard?: Pick<WorkCard, "id" | "type" | "sourcePath"> | null;
}

export function mapResultToCard(input: {
  sessionId: string;
  intent: WriteIntent;
  result: unknown;
  tokens: string;
  meta?: StreamingMeta;
  context?: CardMappingContext;
}): WorkCard {
  const { sessionId, intent, result, tokens, meta, context } = input;

  const parentCard = context?.parentCard;
  const currentStep = intent.type === "angles" ? "angle" : intent.type;


  // Build sourcePath by inheriting parent's path (if any) and appending the current step
  const parentPath = parentCard?.sourcePath;
  const pathBase: string[] = parentPath?.length ? [...parentPath] : parentCard ? [parentCard.type] : ["用户输入"];
  const sourcePath: string[] =
    pathBase[pathBase.length - 1] === currentStep ? pathBase : [...pathBase, currentStep];

  const base = {
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant" as const,
    rawData: result,
    sourcePath,
    sourceCardId: parentCard?.id,
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
    case "joke_to_premise": {
      const rec = r.recommendation as Record<string, unknown> | undefined;
      const recTitle = (rec?.title as string | undefined) ?? (rec?.text as string | undefined);
      const firstPremise =
        Array.isArray(r.premises) && r.premises.length > 0
          ? ((r.premises[0] as Record<string, unknown>)?.title as string | undefined) ??
            ((r.premises[0] as Record<string, unknown>)?.opening_line as string | undefined) ??
            (typeof r.premises[0] === "string" ? r.premises[0] : undefined)
          : undefined;
      const premise =
        recTitle ??
        firstPremise ??
        (r.core_topic as string | undefined) ??
        fallback;
      return premise;
    }

    case "premise": {
      return formatPremiseContent(r, fallback);
    }

    case "angles": {
      const angles = r.angles ?? (r.result as Record<string, unknown>)?.angles ?? r.items;
      if (Array.isArray(angles)) {
        return angles
          .map((item, idx) => {
            if (typeof item === "string") return `${idx + 1}. ${item}`;
            const obj = item as Record<string, unknown>;
            const title = (obj.title as string | undefined) ?? "";
            const desc =
              (obj.description as string | undefined) ??
              (obj.content as string | undefined) ??
              (obj.expansion_idea as string | undefined) ??
              (obj.premise as string | undefined) ??
              "";
            return `${idx + 1}. ${title}${title && desc ? " — " : ""}${desc}`;
          })
          .join("\n");
      }
      return fallback;
    }

    case "rewrite": {
      return formatRewriteContent(r, fallback);
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

// ─── Rewrite 格式化 ──────────────────────────────────────────

function formatRewriteContent(r: Record<string, unknown>, fallback: string): string {
  const lines: string[] = [];

  // Primary output: 改稿版本
  const improvedScript =
    (r.improved_script as string | undefined) ??
    ((r.result as Record<string, unknown>)?.improved_script as string | undefined) ??
    (r.script as string | undefined) ??
    ((r.result as Record<string, unknown>)?.script as string | undefined) ??
    ((r.result as Record<string, unknown>)?.improved as string | undefined) ??
    (fallback || "");

  lines.push("━━ 改稿版本 ━━");
  lines.push("");
  lines.push(improvedScript);

  // 修改理由
  const scriptChanges = r.script_changes ?? r.suggestions ?? r.changes;
  const suggestionItems: Array<{ text?: string; reason?: string; original?: string; improved?: string; technique_added?: string }> =
    Array.isArray(scriptChanges) ? scriptChanges : [];
  const reasons = suggestionItems
    .map((s) => s.reason ?? (s.text && !s.technique_added ? s.text : undefined))
    .filter(Boolean) as string[];
  if (reasons.length > 0) {
    lines.push("");
    lines.push("━━ 修改理由 ━━");
    reasons.forEach((reason) => {
      lines.push(`· ${reason}`);
    });
  }

  // 新增技巧
  const techniquesAdded = suggestionItems
    .map((s) => s.technique_added)
    .filter(Boolean) as string[];
  const allTechniques: string[] = [
    ...techniquesAdded,
    ...((r.techniques as string[] | undefined) ?? []),
    ...(((r.result as Record<string, unknown>)?.techniques as string[] | undefined) ?? []),
  ];
  const uniqueTechniques = [...new Set(allTechniques)];
  if (uniqueTechniques.length > 0) {
    lines.push("");
    lines.push("━━ 新增技巧 ━━");
    uniqueTechniques.forEach((tech) => {
      lines.push(`· ${tech}`);
    });
  }

  // 优化点
  const evalMap = r.evaluation as Record<string, string> | undefined;
  if (evalMap && Object.keys(evalMap).length > 0) {
    lines.push("");
    lines.push("━━ 优化点 ━━");
    Object.entries(evalMap).forEach(([key, val]) => {
      if (val) lines.push(`· ${key}：${val}`);
    });
  }

  return lines.join("\n");
}

// ─── Premise 格式化 ─────────────────────────────────────────

function formatPremiseContent(r: Record<string, unknown>, fallback: string): string {
  const lines: string[] = [];

  // 核心前提
  const premise =
    (r.premise as string | undefined) ??
    (r.core_premise as string | undefined) ??
    (r.text as string | undefined) ??
    fallback;
  lines.push("━━ 前提 ━━");
  lines.push(premise);

  // 主题
  const theme = r.theme as string | undefined;
  if (theme) {
    lines.push("");
    lines.push("━━ 主题 ━━");
    lines.push(theme);
  }

  // 态度
  const attitude = r.attitude as string | undefined;
  if (attitude) {
    lines.push("");
    lines.push("━━ 态度 ━━");
    lines.push(attitude);
  }

  // 推荐前提
  const rec = r.recommendation as Record<string, unknown> | undefined;
  if (rec) {
    const recText = rec.text as string | undefined;
    const recReason = rec.reason as string | undefined;
    if (recText) {
      lines.push("");
      lines.push("━━ 推荐前提 ━━");
      lines.push(recText);
      if (recReason) {
        lines.push(`理由：${recReason}`);
      }
    }
  }

  return lines.length > 2 ? lines.join("\n") : premise;
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
