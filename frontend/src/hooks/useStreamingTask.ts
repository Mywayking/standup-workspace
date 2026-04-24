"use client";

// useStreamingTask - unified streaming task state machine hook
// States: idle | thinking | done | error | cancelled
// Supports: slowWarning, timeout, abort, retry, meta
// Works with all /api/write/*/stream endpoints via standard SSE protocol
import { useCallback, useRef, useState } from "react";
import { streamPost } from "@/lib/api";

export interface StreamingMeta {
  selected_model: string;
  provider?: string;
  attempt_count: number;
  total_latency_ms: number;
  scene?: string;
  request_id?: string;
  [key: string]: unknown;
}

export interface StreamingTaskOptions<T> {
  /** Token callback - receives content string as tokens arrive */
  onToken?: (token: string) => void;
  /** Progress/phase callback */
  onProgress?: (data: { phase?: string; message: string; [key: string]: unknown }) => void;
  /** Warning callback */
  onWarning?: (data: { message: string; [key: string]: unknown }) => void;
  /** Metadata callback (model name, latency, fallback count) */
  onMeta?: (meta: StreamingMeta) => void;
  /** Final result callback */
  onDone?: (result: T, meta?: StreamingMeta) => void;
  /** Error callback */
  onError?: (error: string, errorCode?: string, meta?: StreamingMeta) => void;
  /** Timeout in ms, default 120_000 */
  timeoutMs?: number;
  /** Slow response warning threshold in ms, default 30_000 */
  slowWarningMs?: number;
}

export interface StreamingTaskState {
  phase: "idle" | "thinking" | "done" | "error" | "cancelled";
  slowWarning: boolean;
  meta: StreamingMeta | null;
  error: string | null;
  tokens: string;
}

export interface StreamingTaskResult<T> {
  state: StreamingTaskState;
  start: (body: Record<string, string>) => void;
  abort: () => void;
  retry: () => void;
  setError: (msg: string) => void;
}

/**
 * Hook factory: given an endpoint, returns state + actions.
 * Body is provided by caller at start() time.
 */
export function useStreamingTask<T>(
  endpoint: string,
  options: StreamingTaskOptions<T> = {}
): StreamingTaskResult<T> {
  const {
    onToken,
    onProgress,
    onWarning,
    onMeta,
    onDone,
    onError,
    timeoutMs = 120_000,
    slowWarningMs = 30_000,
  } = options;

  const [state, setState] = useState<StreamingTaskState>({
    phase: "idle",
    slowWarning: false,
    meta: null,
    error: null,
    tokens: "",
  });

  const controllerRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<T | null>(null);
  const metaRef = useRef<StreamingMeta | null>(null);

  const clearTimers = useCallback(() => {
    if (slowTimerRef.current !== null) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    if (timeoutTimerRef.current !== null) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    clearTimers();
    setState((s) =>
      s.phase === "thinking" ? { ...s, phase: "cancelled", slowWarning: false } : s
    );
  }, [clearTimers]);

  const start = useCallback(
    (body: Record<string, string>) => {
      if (state.phase === "thinking") return;

      clearTimers();
      resultRef.current = null;
      metaRef.current = null;

      const controller = new AbortController();
      controllerRef.current = controller;

      setState({
        phase: "thinking",
        slowWarning: false,
        meta: null,
        error: null,
        tokens: "",
      });

      slowTimerRef.current = setTimeout(() => {
        setState((s) =>
          s.phase === "thinking" ? { ...s, slowWarning: true } : s
        );
      }, slowWarningMs);

      timeoutTimerRef.current = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      streamPost(endpoint, body, {
        signal: controller.signal,
        timeoutMs,
        onToken: (token: string) => {
          setState((s) => ({ ...s, tokens: s.tokens + token }));
          onToken?.(token);
        },
        onEvent: (evt, data) => {
          if (evt === "progress") {
            const d = data as { phase?: string; message?: string; status?: string; [key: string]: unknown };
            onProgress?.({ phase: d.phase, message: String(d.message ?? d.status ?? "") });
          } else if (evt === "warning") {
            const d = data as { message?: string; [key: string]: unknown };
            onWarning?.({ message: d.message || "" });
          } else if (evt === "done") {
            clearTimers();
            const d = data as { result?: T; _meta?: StreamingMeta };
            // Normalize: extract result if present, otherwise use data directly
            const raw = d.result !== undefined ? d.result : (data as T);
            // If _raw flag is set, the JSON was incomplete — treat as invalid
            const normalized = (raw as Record<string, unknown>)?._raw === true ? null : raw;
            if (normalized === null) {
              onError?.("模型返回格式不完整，请重试", "INVALID_RESPONSE", metaRef.current ?? undefined);
              return;
            }
            resultRef.current = normalized;
            metaRef.current = d._meta ?? null;
            setState((s) => ({
              ...s,
              phase: "done",
              slowWarning: false,
              meta: d._meta ?? null,
            }));
            onDone?.(resultRef.current, metaRef.current ?? undefined);
          } else if (evt === "error") {
            clearTimers();
            const d = data as { error?: string; error_code?: string; retryable?: boolean; _meta?: StreamingMeta };
            metaRef.current = d._meta ?? null;
            setState((s) => ({
              ...s,
              phase: "error",
              slowWarning: false,
              error: d.error || "Unknown error",
              meta: d._meta ?? null,
            }));
            onError?.(d.error || "Unknown error", d.error_code, d._meta);
          } else if (evt === "meta") {
            const d = data as StreamingMeta;
            metaRef.current = d;
            setState((s) => ({ ...s, meta: d }));
            onMeta?.(d);
          } else if (evt === "analysis" || evt === "warning") {
            const d = data as { message?: string; [key: string]: unknown };
            if (evt === "warning") {
              onWarning?.({ message: d.message || "" });
            } else {
              onProgress?.({ phase: "analyzing", message: "Analyzing..." });
            }
          }
        },
      }).catch((err: unknown) => {
        clearTimers();
        const errName = (err as Error)?.name ?? "";
        const errMsg = (err as Error)?.message ?? "";
        if (errName === "AbortError" || errName === "CanceledError") {
          setState((s) =>
            s.phase === "thinking"
              ? { ...s, phase: "cancelled", slowWarning: false }
              : s
          );
        } else if (
          errMsg.includes("timeout") ||
          errMsg.includes("超时")
        ) {
          setState((s) => ({
            ...s,
            phase: "error",
            slowWarning: false,
            error: "Model response timeout, please retry",
          }));
          onError?.("Model response timeout, please retry", "TIMEOUT", metaRef.current ?? undefined);
        } else if (
          errMsg.includes("network") ||
          errMsg.includes("Failed to fetch") ||
          errMsg.includes("Load failed")
        ) {
          setState((s) => ({
            ...s,
            phase: "error",
            slowWarning: false,
            error: "Network error, please check connection",
          }));
          onError?.("Network error, please check connection", "NETWORK", metaRef.current ?? undefined);
        } else {
          setState((s) => ({
            ...s,
            phase: "error",
            slowWarning: false,
            error: errMsg || "Generation failed, please retry",
          }));
          onError?.(errMsg || "Generation failed, please retry", "UNKNOWN", metaRef.current ?? undefined);
        }
      });
    },
    [state.phase, clearTimers, endpoint, onToken, onProgress, onWarning, onMeta, onDone, onError, slowWarningMs, timeoutMs]
  );

  const retry = useCallback(() => {
    setState({
      phase: "idle",
      slowWarning: false,
      meta: null,
      error: null,
      tokens: "",
    });
  }, []);

  const setError = useCallback((msg: string) => {
    clearTimers();
    setState((s) => ({
      ...s,
      phase: "error",
      slowWarning: false,
      error: msg,
      meta: null,
    }));
  }, [clearTimers]);

  return { state, start, abort, retry, setError };
}
