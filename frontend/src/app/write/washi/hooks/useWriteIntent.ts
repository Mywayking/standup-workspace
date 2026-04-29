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

  // Rule 1: 找角度
  if (
    input.includes("找角度") ||
    input.includes("换个角度") ||
    input.includes("还有什么方向") ||
    input.includes("发散")
  ) {
    return {
      type: "angles",
      endpoint: WRITE_ENDPOINT_MAP.angles,
      confidence: 0.92,
      reason: "user explicitly asks for angles",
    };
  }

  // Rule 2: 改稿意图
  if (
    input.includes("改稿") ||
    input.includes("润色") ||
    input.includes("更好笑") ||
    input.includes("更毒舌") ||
    len > 180
  ) {
    return {
      type: "rewrite",
      endpoint: WRITE_ENDPOINT_MAP.rewrite,
      confidence: 0.86,
      reason: "rewrite intent or long text",
    };
  }

  // Rule 3: 梗写前提
  if (
    input.includes("梗写前提") ||
    input.includes("反推前提") ||
    input.includes("倒推前提") ||
    input.includes("这句梗")
  ) {
    return {
      type: "joke_to_premise",
      endpoint: WRITE_ENDPOINT_MAP.joke_to_premise,
      confidence: 0.82,
      reason: "joke-to-premise explicit request",
    };
  }

  // Rule 4: Default → premise
  return {
    type: "premise",
    endpoint: WRITE_ENDPOINT_MAP.premise,
    confidence: 0.78,
    reason: "default material to premise",
  };
}
