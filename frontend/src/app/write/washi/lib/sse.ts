// ============================================================
// lib/sse.ts — Standard SSE streaming utility
// Standup Workspace v3.0
// ============================================================

export interface StreamMeta {
  model?: string;
  provider?: string;
  requestId?: string;
  totalLatencyMs?: number;
  attemptCount?: number;
  scene?: string;
  [key: string]: unknown;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onMeta?: (meta: StreamMeta) => void;
  /** onDone is always called at stream EOF (not just on event:done).
   *  tokens: the full accumulated token string (from the internal ref).
   *          Use this instead of reading task.state.tokens, which may not
   *          be flushed yet due to React 18 state batching. */
  onDone?: (raw?: string, tokens?: string) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Parse a single SSE line into {event, data}.
 * Handles: "event: foo", "data: bar", ""
 */
function parseSSEField(line: string): { event: string; data: string } | null {
  if (line.startsWith("event: ")) return { event: line.slice(7).trim(), data: "" };
  if (line.startsWith("data: ")) return { event: "", data: line.slice(6) };
  if (line.trim() === "") return { event: "", data: "" };
  return null;
}

/**
 * Extract token text from a token event data string.
 * Tries JSON.parse first for {content, text}, falls back to raw string.
 */
function extractTokenContent(dataStr: string): string {
  try {
    const parsed = JSON.parse(dataStr);
    if (typeof parsed === "object" && parsed !== null) {
      if (typeof parsed.content === "string") return parsed.content;
      if (typeof parsed.text === "string") return parsed.text;
      // Fall through to return raw if no recognized field
    }
  } catch {
    // Not JSON — use raw
  }
  return dataStr;
}

// Track accumulated token for multi-line JSON (data field spans multiple lines)
// This handles cases where a data: JSON value contains literal newlines.
// Each complete token JSON is stored in tokensRef and onDone reconstructs from it.
// We accumulate in tokensAccum since we can't call onToken for incomplete JSON.

/**
 * Core SSE streaming function.
 *
 * @param endpoint  Backend URL (e.g. "/api/write/premise/stream")
 * @param body      JSON-serializable request body
 * @param callbacks Handlers for each SSE event type
 */
export async function streamSSE(
  endpoint: string,
  body: Record<string, unknown>,
  callbacks: StreamCallbacks
): Promise<void> {
  const { onToken, onMeta, onDone, onError, signal } = callbacks;

  // ── Validate body ──────────────────────────────────────────
  if (!body || Object.keys(body).length === 0) {
    onError?.("请求body不能为空");
    return;
  }

  // ── Build AbortController ───────────────────────────────────
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  const combinedSignal = signal
    ? (() => {
        signal.addEventListener("abort", () => controller.abort());
        return controller.signal;
      })()
    : controller.signal;

  // ── Fetch ───────────────────────────────────────────────────
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const name = (err as Error)?.name ?? "";
    if (name === "AbortError" || name === "CanceledError") {
      onError?.("请求已取消");
    } else {
      onError?.("网络错误，请检查网络连接");
    }
    return;
  }

  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    onError?.(`请求失败 (${res.status}): ${text || res.statusText}`);
    return;
  }

  // ── Stream SSE ───────────────────────────────────────────────
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Accumulators for the current SSE block (separated by blank lines)
  let currentEvent = "";
  let currentData = "";  // raw dataStr accumulator for multi-line JSON values

  // tokensAccum: accumulates the raw dataStr values between blank lines.
  // This handles multi-line JSON in a single data: field (embedded newlines).
  // The key insight: in SSE, blank lines ("\n\n" or trailing "\n") are block
  // separators. Within a block, each "data: X" line is appended.
  // We dispatch when we hit a blank line — the full concatenated dataStr is
  // then parsed as one unit (correct for multi-line JSON).
  //
  // BUG FIX: previously, if multiple "data:" lines arrived before a blank
  // line (e.g. backend sends token JSONs back-to-back), they were all
  // concatenated into one dataStr and JSON.parse would fail.
  // The fix: each token event has exactly ONE "data:" line in the standard
  // backend format. We handle multi-line JSON by accumulating the dataStr
  // within the block and dispatching once per blank line.
  //
  // Additionally, we now always call onDone when the stream ends (not just
  // when an "event: done" line is received), so the card is always created.

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Last element may be incomplete — keep it in buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseSSEField(line);

      if (!parsed) continue;

      // Empty line → block separator → dispatch accumulated event
      if (parsed.event === "" && parsed.data === "") {
        if (currentEvent && currentData) {
          const dataStr = currentData.trim();
          dispatchEvent(currentEvent, dataStr);
          currentEvent = "";
          currentData = "";
        }
        continue;
      }

      if (parsed.event) currentEvent = parsed.event;
      if (parsed.data) currentData += parsed.data + "\n";
    }
  }

  // Dispatch any remaining accumulated event after stream ends
  if (currentEvent && currentData) {
    dispatchEvent(currentEvent, currentData.trim());
  }

  // Always call onDone when stream ends — even if backend didn't send
  // "event: done". This ensures the card is always created.
  // We pass undefined for raw since we don't use it in onDone handlers.
  onDone?.(undefined);

  function dispatchEvent(event: string, dataStr: string) {
    switch (event) {
      case "meta": {
        try {
          const meta = JSON.parse(dataStr) as StreamMeta;
          onMeta?.(meta);
        } catch {
          // ignore malformed meta
        }
        break;
      }

      case "token": {
        // Handle multiple concatenated token JSONs (can happen when multiple
        // "data:" lines arrive in the same SSE block without blank-line separators).
        // Split by newlines and process each one independently.
        const parts = dataStr.split("\n").filter((p) => p.trim());
        for (const part of parts) {
          const content = extractTokenContent(part);
          if (content) onToken?.(content);
        }
        break;
      }

      case "done": {
        // "event: done" is now redundant — onDone is always called at EOF.
        // Still handle it gracefully if backend sends it explicitly.
        break;
      }

      case "error": {
        try {
          const errData = JSON.parse(dataStr) as { error?: string };
          onError?.(errData.error ?? "Unknown error");
        } catch {
          onError?.(dataStr || "Unknown error");
        }
        break;
      }

      default:
        break;
    }
  }
}
