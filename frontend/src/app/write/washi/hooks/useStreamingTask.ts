// ============================================================
// hooks/useStreamingTask.ts — Reusable SSE streaming hook
// Standup Workspace v3.0
// ============================================================

import { useCallback, useRef, useState } from "react";
import { streamSSE, type StreamCallbacks, type StreamMeta } from "../lib/sse";

export interface StreamingTaskState {
  isRunning: boolean;
  tokens: string;
  error: string | null;
  meta: StreamMeta;
  latencyMs: number | null;
}

export interface StreamingTaskResult {
  /** Run a streaming task against an endpoint */
  run(
    endpoint: string,
    body: Record<string, unknown>,
    callbacks?: Partial<StreamCallbacks>
  ): Promise<{ content: string; meta: StreamMeta; latencyMs: number }>;
  /** Abort the in-flight request */
  abort(): void;
  /** Current streaming state */
  state: StreamingTaskState;
}

// ─── State shape (compatible with existing WashiWriteClient UI) ──

interface InternalState {
  isRunning: boolean;
  tokens: string;
  error: string | null;
  meta: StreamMeta;
  latencyMs: number | null;
}

// ─── Hook ────────────────────────────────────────────────────

export function useStreamingTask(): StreamingTaskResult {
  const [state, setState] = useState<InternalState>({
    isRunning: false,
    tokens: "",
    error: null,
    meta: {},
    latencyMs: null,
  });

  const controllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const tokensRef = useRef<string>("");
  const metaRef = useRef<StreamMeta>({});
  const phaseRef = useRef<"idle" | "thinking" | "done" | "error" | "cancelled">("idle");

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    const latencyMs = Date.now() - startTimeRef.current;
    setState((s) => ({
      ...s,
      isRunning: false,
      latencyMs,
    }));
  }, []);

  const run = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      callbacks?: Partial<StreamCallbacks>
    ): Promise<{ content: string; meta: StreamMeta; latencyMs: number }> => {
      // Abort any existing request
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;
      startTimeRef.current = Date.now();
      tokensRef.current = "";
      metaRef.current = {};

      setState({
        isRunning: true,
        tokens: "",
        error: null,
        meta: {},
        latencyMs: null,
      });

      return new Promise((resolve, reject) => {
        let tokenCount = 0;
        streamSSE(endpoint, body, {
          signal: controller.signal,

          onToken(token: string) {
            tokenCount++;
            tokensRef.current += token;
            setState((s) => ({
              ...s,
              tokens: tokensRef.current,
            }));
            if (tokenCount <= 3 || tokenCount % 100 === 0) {
            }
            callbacks?.onToken?.(token);
          },

          onMeta(meta: StreamMeta) {
            metaRef.current = { ...metaRef.current, ...meta };
            setState((s) => ({
              ...s,
              meta: metaRef.current,
            }));
            callbacks?.onMeta?.(meta);
          },

          onDone(raw?: string) {
            const latencyMs = Date.now() - startTimeRef.current;
            const content = tokensRef.current.trim();
            setState((s) => ({
              ...s,
              isRunning: false,
              latencyMs,
              meta: metaRef.current,
            }));
            // Pass tokensRef.current directly — task.state.tokens may not be
            // flushed yet due to React 18 batching when onDone fires.
            callbacks?.onDone?.(raw, tokensRef.current);
            resolve({ content, meta: metaRef.current, latencyMs });
          },

          onError(message: string) {
            const latencyMs = Date.now() - startTimeRef.current;
            setState((s) => ({
              ...s,
              isRunning: false,
              error: message,
              latencyMs,
            }));
            callbacks?.onError?.(message);
            reject(new Error(message));
          },
        });
      });
    },
    [] // no deps — always create fresh AbortController
  );

  return { run, abort, state };
}
