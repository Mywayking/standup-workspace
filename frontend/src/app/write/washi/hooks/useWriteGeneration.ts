// ============================================================
// hooks/useWriteGeneration.ts — 流式生成 Hook
// Standup Workspace v3.0
// ============================================================

import { useState, useCallback } from "react";
import { useStreamingTask } from "@/hooks/useStreamingTask";
import type { WorkCard, WriteIntent } from "../types";
import type { StreamingMeta } from "@/hooks/useStreamingTask";
import { mapResultToCard, mapErrorToCard } from "../lib/cardMappers";
import { buildRequestBody } from "../lib/requestAdapters";
import { detectWriteIntent } from "./useWriteIntent";

// ─── Hook ────────────────────────────────────────────────────

interface UseWriteGenerationOptions {
  sessionId: string;
  onCardCreated: (card: WorkCard) => void;
}

export function useWriteGeneration(options: UseWriteGenerationOptions) {
  const [intent, setIntent] = useState<WriteIntent | null>(null);
  const [draftTokens, setDraftTokens] = useState("");

  const endpoint = intent?.endpoint ?? "/api/write/premise/stream";

  const task = useStreamingTask<unknown>(endpoint, {
    timeoutMs: 120_000,
    slowWarningMs: 25_000,

    onToken(token: string) {
      setDraftTokens((prev) => prev + token);
    },

    onDone(result: unknown, meta) {
      if (!intent) return;
      const card = mapResultToCard({
        sessionId: options.sessionId,
        intent,
        result,
        tokens: draftTokens,
        meta: meta ?? undefined,
      });
      options.onCardCreated(card);
      setDraftTokens("");
      setIntent(null);
    },

    onError(error: string, errorCode?: string, meta?: StreamingMeta) {
      const card = mapErrorToCard({
        sessionId: options.sessionId,
        error,
        errorCode,
        meta: meta ?? undefined,
      });
      options.onCardCreated(card);
      setDraftTokens("");
      setIntent(null);
    },
  });

  function start(text: string, extra?: Record<string, string>) {
    const nextIntent = detectWriteIntent(text);
    setIntent(nextIntent);
    setDraftTokens("");

    const body = buildRequestBody(nextIntent, text, extra);
    task.start(body as Record<string, string>);
  }

  function retry() {
    if (!intent) return;
    setDraftTokens("");
    task.retry();
  }

  return {
    intent,
    state: task.state,
    draftTokens,
    start,
    abort: task.abort,
    retry,
  };
}
