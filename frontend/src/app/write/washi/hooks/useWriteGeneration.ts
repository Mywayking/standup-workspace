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

interface UseWriteGenerationOptions {
  sessionId: string;
  onCardCreated: (card: WorkCard) => void;
}

export function useWriteGeneration(options: UseWriteGenerationOptions, activeSessionId: string | null) {
  const [intent, setIntent] = useState<WriteIntent | null>(null);
  const [draftTokens, setDraftTokens] = useState("");
  // Ref to track the sessionId used in the current/last generation request.
  // This is set in start() and read in onDone/onError callbacks, avoiding
  // the stale closure problem where React state hasn't been flushed yet.
  const currentSessionIdRef = useRef<string | null>(null);

  const task = useStreamingTask();

  function start(text: string, extra?: Record<string, string>, sessionId?: string) {
    const nextIntent = detectWriteIntent(text);
    setIntent(nextIntent);
    setDraftTokens("");

    // Use provided sessionId (from the call site that has the fresh session ID),
    // falling back to activeSessionId from the hook's state.
    const resolvedSessionId = sessionId ?? activeSessionId ?? "";
    // Store in ref so onDone/onError callbacks can read it without stale closure
    currentSessionIdRef.current = resolvedSessionId || null;
    const body = buildRequestBody(nextIntent, text, extra, resolvedSessionId || undefined);
    const endpoint = nextIntent.endpoint;

    task.run(endpoint, body as Record<string, unknown>, {
      onToken(token: string) {
        setDraftTokens((prev) => prev + token);
      },
      onMeta(meta: StreamMeta) {
        // meta available via state.meta — no-op for card mapping
        void meta;
      },
      onDone(raw?: string, tokens?: string) {
        // Use the tokens passed directly from useStreamingTask's tokensRef,
        // bypassing React state batching. task.state.tokens may be empty
        // here because React hasn't flushed the batched setState calls yet.
        const accumulatedTokens = tokens ?? task.state.tokens;
        if (!nextIntent) {
          return;
        }
        void raw;
        const result = parseDoneResult(accumulatedTokens);
        // Use the sessionId from the ref (set in start()), not options.sessionId
        // (which may be the initial empty string from component mount).
        const cardSessionId = currentSessionIdRef.current ?? options.sessionId;
        const card = mapResultToCard({
          sessionId: cardSessionId,
          intent: nextIntent,
          result,
          tokens: accumulatedTokens,
          meta: convertMeta(task.state.meta),
        });
        options.onCardCreated(card);
        setDraftTokens("");
      },
      onError(error: string) {
        if (!nextIntent) return;
        const card = mapErrorToCard({
          sessionId: options.sessionId,
          error,
          meta: convertMeta(task.state.meta),
        });
        options.onCardCreated(card);
        setDraftTokens("");
      },
    });
  }

  function retry() {
    // retry is not yet supported in the new hook
    // callers need to re-submit the original input
  }

  function abort() {
    task.abort();
    setIntent(null);
  }

  return {
    intent,
    // Expose phase-compatible shape for WashiWriteClient
    state: {
      phase: task.state.isRunning ? "thinking" : task.state.error ? "error" : task.state.latencyMs !== null && !task.state.isRunning ? "done" : "idle",
      slowWarning: false,
      meta: {
        selected_model: task.state.meta?.model,
        provider: task.state.meta?.provider,
        request_id: task.state.meta?.requestId,
        total_latency_ms: task.state.meta?.totalLatencyMs,
        attempt_count: task.state.meta?.attemptCount,
      },
      error: task.state.error,
      tokens: task.state.tokens,
    } as unknown as ReturnType<typeof import("@/hooks/useStreamingTask").useStreamingTask>["state"],
    draftTokens,
    start,
    abort,
    retry,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Parse the accumulated tokens into a structured result.
 * The backend returns JSON, so we try to parse the full token string.
 */
function parseDoneResult(tokens: string): unknown {
  try {
    return JSON.parse(tokens.trim());
  } catch {
    return { content: tokens };
  }
}

// ─── Meta conversion ─────────────────────────────────────────

/**
 * Convert from lib/sse StreamMeta (new) to @/hooks/useStreamingTask StreamingMeta (legacy).
 * The cardMappers.ts expects the legacy shape.
 */
function convertMeta(meta: StreamMeta): import("@/hooks/useStreamingTask").StreamingMeta | undefined {
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