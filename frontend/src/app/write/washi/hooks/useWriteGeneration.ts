// ============================================================
// hooks/useWriteGeneration.ts — 流式生成 Hook
// Standup Workspace v3.0
// ============================================================

import { useState, useCallback, useRef } from "react";
import { useStreamingTask } from "./useStreamingTask";
import type { WorkCard, WriteIntent } from "../types";
import type { StreamMeta } from "../lib/sse";
import { mapResultToCard, mapErrorToCard } from "../lib/cardMappers";
import { buildRequestBody } from "../lib/requestAdapters";
import { detectWriteIntent } from "./useWriteIntent";

// ─── Hook ────────────────────────────────────────────────────

interface StartParams {
  text: string;
  sessionId: string;
  forcedIntent?: WriteIntent;
  extra?: Record<string, string>;
  /** The card that triggered this generation — used to build parentId + sourcePath chain. */
  parentCard?: Pick<WorkCard, "id" | "type" | "sourcePath">;
}

interface UseWriteGenerationOptions {
  sessionId: string;
  onCardCreated: (card: WorkCard) => void;
}

export function useWriteGeneration(
  options: UseWriteGenerationOptions,
  activeSessionId: string | null
) {
  const [intent, setIntent] = useState<WriteIntent | null>(null);
  const [draftTokens, setDraftTokens] = useState("");

  // Refs to avoid stale closures in async callbacks
  const intentRef = useRef<WriteIntent | null>(null);
  const tokensRef = useRef<string>("");
  const sessionIdRef = useRef<string | null>(null);
  const parentCardRef = useRef<StartParams["parentCard"]>(null);

  const task = useStreamingTask();

  const start = useCallback(
    (params: StartParams) => {
      const { text, sessionId, forcedIntent, extra, parentCard } = params;
      const nextIntent = forcedIntent ?? detectWriteIntent(text);

      setIntent(nextIntent);
      setDraftTokens("");
      tokensRef.current = "";

      // Set refs BEFORE calling task.run() so callbacks can read fresh values
      intentRef.current = nextIntent;
      sessionIdRef.current = sessionId || activeSessionId || null;
      parentCardRef.current = parentCard ?? undefined;

      // Build request body
      const resolvedSessionId = sessionId || activeSessionId || "";
      const body = buildRequestBody(
        nextIntent,
        text,
        extra,
        resolvedSessionId || undefined
      );

      task.run(nextIntent.endpoint, body as Record<string, unknown>, {
        onToken(token: string) {
          tokensRef.current += token;
          setDraftTokens(tokensRef.current);
        },

        onMeta(meta: StreamMeta) {
          void meta;
        },

        onDone(raw?: string, tokens?: string) {
          // Use tokens passed directly from useStreamingTask's tokensRef,
          // bypassing React state batching which may not have flushed yet.
          const accumulatedTokens = tokens ?? tokensRef.current;
          const currentIntent = intentRef.current;
          if (!currentIntent) return;
          void raw;

          const result = parseDoneResult(accumulatedTokens);
          const cardSessionId = sessionIdRef.current ?? options.sessionId;

          const card = mapResultToCard({
            sessionId: cardSessionId,
            intent: currentIntent,
            result,
            tokens: accumulatedTokens,
            meta: convertMeta(task.state.meta),
            context: { parentCard: parentCardRef.current },
          });
          options.onCardCreated(card);
          setDraftTokens("");
        },

        onError(error: string) {
          const currentIntent = intentRef.current;
          const cardSessionId = sessionIdRef.current ?? options.sessionId;
          const card = mapErrorToCard({
            sessionId: cardSessionId,
            error,
            meta: convertMeta(task.state.meta),
          });
          options.onCardCreated(card);
          setDraftTokens("");
        },
      });
    },
    [activeSessionId, options, task]
  );

  function retry() {
    // retry is not yet supported — callers need to re-submit the original input
  }

  function abort() {
    task.abort();
    setIntent(null);
  }

  return {
    intent,
    state: {
      isRunning: task.state.isRunning,
      tokens: draftTokens,
      phase: task.state.isRunning ? "thinking" : task.state.error ? "error" : "idle",
      meta: {
        selected_model: task.state.meta?.model,
        provider: task.state.meta?.provider,
        request_id: task.state.meta?.requestId,
        total_latency_ms: task.state.meta?.totalLatencyMs,
        attempt_count: task.state.meta?.attemptCount,
      },
    },
    draftTokens,
    start,
    abort,
    retry,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function parseDoneResult(tokens: string): unknown {
  try {
    return JSON.parse(tokens.trim());
  } catch {
    return { content: tokens };
  }
}

function convertMeta(
  meta: StreamMeta
): {
  selected_model: string;
  provider?: string;
  request_id?: string;
  total_latency_ms: number;
  attempt_count: number;
  scene?: string;
} | undefined {
  if (!meta || Object.keys(meta).length === 0) return undefined;
  return {
    selected_model: meta.model ?? "",
    provider: meta.provider,
    request_id: meta.requestId,
    total_latency_ms: meta.totalLatencyMs ?? 0,
    attempt_count: meta.attemptCount ?? 1,
    scene: meta.scene,
  };
}