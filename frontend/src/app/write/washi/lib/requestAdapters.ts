// ============================================================
// lib/requestAdapters.ts — 请求体适配层
// Standup Workspace v3.0
// ============================================================

import type { WriteIntent } from "../types";

/**
 * 根据意图类型构建不同接口的请求体。
 * 统一适配逻辑，后续后端字段变化只改这里。
 */
export function buildRequestBody(
  intent: WriteIntent,
  text: string,
  extra?: Record<string, string>,
  existingSessionId?: string
): Record<string, string> {
  const sessionId = existingSessionId ?? crypto.randomUUID();
  const base = { session_id: sessionId, ...extra };

  switch (intent.type) {
    case "rewrite":
      return { text, mode: "quick", ...base };

    case "angles":
      return { premise: text, count: "5", ...base };

    case "joke_to_premise":
      return { text, ...base };

    case "feedback":
      return {
        laugh_parts: extra?.laughParts ?? "",
        flop_parts: extra?.flopParts ?? "",
        forgot_parts: extra?.forgotParts ?? "",
        original_script: text,
        ...base,
      };

    case "premise":
    default:
      return { text, material: text, ...base };
  }
}