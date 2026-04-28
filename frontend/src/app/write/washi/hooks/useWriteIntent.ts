// ============================================================
// hooks/useWriteIntent.ts — 规则化意图检测
// Standup Workspace v3.0
// ============================================================

import type { WriteIntent } from "../types";
import { WRITE_ENDPOINT_MAP } from "../lib/endpointMap";

/**
 * 基于规则的意图检测（第一阶段）。
 * 后续可替换为 AI 分类接口。
 */
export function detectWriteIntent(text: string): WriteIntent {
  const input = text.trim();
  const len = input.length;

  if (!input) {
    return {
      type: "unknown",
      endpoint: WRITE_ENDPOINT_MAP.unknown,
      confidence: 0,
      reason: "empty input",
    };
  }

  // 明确要求找角度
  if (
    input.includes("找角度") ||
    input.includes("角度") ||
    input.includes("还有什么方向") ||
    input.includes("再找")
  ) {
    return {
      type: "angles",
      endpoint: WRITE_ENDPOINT_MAP.angles,
      confidence: 0.92,
      reason: "user explicitly asks for angles",
    };
  }

  // 快捷按钮前缀检测（优先于通用规则）
  if (
    input.includes("前提：") ||
    input.startsWith("前提")
  ) {
    return {
      type: "premise",
      endpoint: WRITE_ENDPOINT_MAP.premise,
      confidence: 0.95,
      reason: "explicit premise prefix",
    };
  }

  if (
    input.includes("改稿：") ||
    input.startsWith("改稿")
  ) {
    return {
      type: "rewrite",
      endpoint: WRITE_ENDPOINT_MAP.rewrite,
      confidence: 0.95,
      reason: "explicit rewrite prefix",
    };
  }

  if (
    input.includes("找角度：") ||
    input.startsWith("找角度")
  ) {
    return {
      type: "angles",
      endpoint: WRITE_ENDPOINT_MAP.angles,
      confidence: 0.95,
      reason: "explicit angles prefix",
    };
  }

  // 改稿意图（长文本或包含改稿关键词）
  if (
    input.includes("改稿") ||
    input.includes("更好笑") ||
    input.includes("更毒舌") ||
    input.includes("更克制") ||
    input.includes("润色") ||
    input.includes("优化") ||
    len > 160
  ) {
    return {
      type: "rewrite",
      endpoint: WRITE_ENDPOINT_MAP.rewrite,
      confidence: 0.86,
      reason: "long draft or rewrite intent",
    };
  }

  // 短梗 → 梗写前提
  if (
    input.includes("反推前提") ||
    input.includes("梗写前提") ||
    input.includes("这句梗") ||
    input.includes("笑点") ||
    (len < 70 && len > 0)
  ) {
    return {
      type: "joke_to_premise",
      endpoint: WRITE_ENDPOINT_MAP.joke_to_premise,
      confidence: 0.74,
      reason: "short punchline-like input",
    };
  }

  // 默认 → 素材提炼前提
  return {
    type: "premise",
    endpoint: WRITE_ENDPOINT_MAP.premise,
    confidence: 0.78,
    reason: "default material to premise",
  };
}
