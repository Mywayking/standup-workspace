"use client";
/**
 * useStreamingTask — 统一流式任务状态机 Hook
 *
 * 支持 states: idle | thinking | done | error | cancelled
 * 支持: slowWarning, timeout, abort, retry, meta
 *
 * 适用于 /api/write/*/stream 所有端点，遵循标准 SSE 协议：
 *   event: progress → {type:"progress", phase, message}
 *   event: token    → {type:"token", content} (onEvent receives content string)
 *   event: done     → {type:"done", result, _meta}
 *   event: error    → {type:"error", error, error_code, retryable, _meta}
 *   event: meta     → {type:"meta", selected_model, provider, attempt_count, total_latency_ms, scene, request_id}
 */
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
  /** 流式 token 回调（content 字符串） */
  onToken?: (token: string) => void;
  /** 进度/阶段回调 */
  onProgress?: (data: { phase?: string; message: string; [key: string]: unknown }) => void;
  /** 警告回调（非标准，用于旧版 analysis 事件等） */
  onWarning?: (data: { message: string; [key: string]: unknown }) => void;
  /** 元数据回调（模型名/耗时/fallback次数） */
  onMeta?: (meta: StreamingMeta) => void;
  /** 最终结果回调 */
  onDone?: (result: T, meta?: StreamingMeta) => void;
  /** 错误回调 */
  onError?: (error: string, errorCode?: string, meta?: StreamingMeta) => void;
  /** 超时时间 ms，默认 120_000 */
  timeoutMs?: number;
  /** 慢响应警告阈值 ms，默认 30_000 */
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
}

/**
 * Hook 工厂：给定 endpoint，返回 state + actions。
 * body 由 caller 在 start() 时提供。
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

      // Reset
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

      // Slow warning timer
      slowTimerRef.current = setTimeout(() => {
        setState((s) =>
          s.phase === "thinking" ? { ...s, slowWarning: true } : s
        );
      }, slowWarningMs);

      // Timeout timer
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
            const d = data as { phase?: string; message?: string; [key: string]: unknown };
            onProgress?.({ phase: d.phase, message: d.message || d.status || "" });
          } else if (evt === "warning") {
            const d = data as { message?: string; [key: string]: unknown };
            onWarning?.({ message: d.message || "" });
          } else if (evt === "done") {
            clearTimers();
            const d = data as { result?: T; _meta?: StreamingMeta };
            resultRef.current = d.result ?? (data as T);
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
              error: d.error || "未知错误",
              meta: d._meta ?? null,
            }));
            onError?.(d.error || "未知错误", d.error_code, d._meta);
          } else if (evt === "meta") {
            const d = data as StreamingMeta;
            metaRef.current = d;
            setState((s) => ({ ...s, meta: d }));
            onMeta?.(d);
          }
          // analysis / warning events (old protocol) — treated as done with data
          else if (evt === "analysis" || evt === "warning") {
            // For old two-phase protocol (analysis event), treat as progress
            const d = data as { message?: string; [key: string]: unknown };
            if (evt === "warning") {
              onWarning?.({ message: d.message || "" });
            } else {
              onProgress?.({ phase: "analyzing", message: "正在拆解梗..." });
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
            error: "模型响应超时，请重试或稍后再试",
          }));
          onError?.("模型响应超时，请重试或稍后再试", "TIMEOUT", metaRef.current ?? undefined);
        } else if (
          errMsg.includes("network") ||
          errMsg.includes("Failed to fetch") ||
          errMsg.includes("Load failed")
        ) {
          setState((s) => ({
            ...s,
            phase: "error",
            slowWarning: false,
            error: "网络连接异常，请检查网络后重试",
          }));
          onError?.("网络连接异常，请检查网络后重试", "NETWORK", metaRef.current ?? undefined);
        } else {
          setState((s) => ({
            ...s,
            phase: "error",
            slowWarning: false,
            error: errMsg || "生成失败，请重试",
          }));
          onError?.(errMsg || "生成失败，请重试", "UNKNOWN", metaRef.current ?? undefined);
        }
      });
    },
    [state.phase, clearTimers, endpoint, onToken, onProgress, onWarning, onMeta, onDone, onError, slowWarningMs, timeoutMs]
  );

  const retry = useCallback(() => {
    // Retry is not directly supported — caller should store body and call start again
    // This is a placeholder; actual retry is implemented per-tab with stored body
    setState({
      phase: "idle",
      slowWarning: false,
      meta: null,
      error: null,
      tokens: "",
    });
  }, []);

  return { state, start, abort, retry };
}
