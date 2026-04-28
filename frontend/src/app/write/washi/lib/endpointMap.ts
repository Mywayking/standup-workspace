// ============================================================
// lib/endpointMap.ts — 接口端点映射
// Standup Workspace v3.0
// ============================================================

import type { WriteIntentType } from "../types";

export const WRITE_ENDPOINT_MAP: Record<WriteIntentType, string> = {
  premise: "/api/write/premise/stream",
  joke_to_premise: "/api/write/joke-to-premise/stream",
  angles: "/api/write/angles/stream",
  rewrite: "/api/write/rewrite/stream",
  feedback: "/api/write/performance-review/stream",
  unknown: "/api/write/premise/stream",
};
