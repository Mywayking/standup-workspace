// Always use relative URLs - nginx proxies /api/ to the backend
const BASE = "";

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projectApi = {
  list: () => api<import("@/types").Project[]>("/api/projects"),
  create: (data: { name: string; description?: string }) =>
    api<import("@/types").Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    api<void>(`/api/projects/${id}`, { method: "DELETE" }),
};

// ─── Scripts ─────────────────────────────────────────────────────────────────

export const scriptApi = {
  list: (projectId?: number) =>
    api<import("@/types").Script[]>(
      `/api/scripts${projectId ? `?project_id=${projectId}` : ""}`
    ),
  upload: (projectId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/api/scripts/upload?project_id=${projectId}`, {
      method: "POST",
      body: form,
    }).then((r) => {
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      return r.json() as Promise<import("@/types").Script>;
    });
  },
  get: (id: number) =>
    api<import("@/types").ScriptDetail>(`/api/scripts/${id}`),
  delete: (id: number) =>
    api<void>(`/api/scripts/${id}`, { method: "DELETE" }),
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobApi = {
  create: (scriptId: number) =>
    api<import("@/types").AnalysisJob>(`/api/scripts/${scriptId}/analyze`, {
      method: "POST",
    }),
  get: (id: number) =>
    api<import("@/types").AnalysisJob>(`/api/jobs/${id}`),
  streamUrl: (id: number) => `${BASE}/api/jobs/${id}/stream`,
};

// ─── Analysis ─────────────────────────────────────────────────────────────────

export const analysisApi = {
  get: (scriptId: number) =>
    api<import("@/types").Analysis>(`/api/scripts/${scriptId}/analysis`),
  getSegment: (segmentId: number) =>
    api<import("@/types").SegmentDetail>(`/api/segments/${segmentId}/analysis`),
  toggleStar: (segmentId: number, starred: boolean) =>
    api<import("@/types").SegmentDetail>(
      `/api/segments/${segmentId}/star?starred=${starred}`,
      { method: "PATCH" }
    ),
  filter: (req: import("@/types").FilterRequest) =>
    api<import("@/types").FilterResult>("/api/search/filter", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportApi = {
  export: (scriptId: number, format: "json" | "md" | "docx") => {
    const params = new URLSearchParams({ format: String(format) });
    return `${BASE}/api/scripts/${scriptId}/export?${params}`;
  },
};

// ─── Write / Comedy Tools ────────────────────────────────────────────────────

/**
 * SSE 流式 POST 请求。
 * onChunk(data) 每收到一个 data 事件解析后调用。
 * onEvent(event, data) 处理具名事件（progress | analysis | done | error）。
 */
export function streamPost(
  path: string,
  body: Record<string, string>,
  opts?: {
    onChunk?: (data: string, event: string) => void;
    onEvent?: (event: string, data: unknown) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
) {
  const { onChunk, onEvent, signal, timeoutMs = 180_000 } = opts ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const combinedSignal = signal
    ? (() => {
        const s = signal;
        s.addEventListener("abort", () => controller.abort());
        return controller.signal;
      })()
    : controller.signal;

  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: combinedSignal,
  }).then(async (res) => {
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status} ${path}: ${text}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let pendingEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes("\n")) {
        const nl = buffer.indexOf("\n");
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);

        if (line === "") { pendingEvent = ""; continue; }
        if (line.startsWith("event: ")) { pendingEvent = line.slice(7).trim(); continue; }
        if (!line.startsWith("data: ")) continue;

        const dataStr = line.slice(6);
        onChunk?.(dataStr, pendingEvent);
        try {
          const data = JSON.parse(dataStr);
          onEvent?.(pendingEvent, data);
        } catch { /* 非 JSON 数据 */ }
      }
    }
  });
}

export const writeApi = {
  /** 提炼前提（流式） */
  extractPremise: (text: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/extract-premise/stream", { text }, opts),

  /** 梗写前提（流式） */
  jokeToPremise: (text: string, topic?: string, style?: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/joke-to-premise", { text, ...(topic ? { topic } : {}), ...(style ? { style } : {}) }, opts),

  /** 找角度（流式） */
  findAngles: (premise: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/find-angles/stream", { premise }, opts),

  /** 改稿分析（流式） */
  analyze: (text: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/analyze/stream", { text }, opts),
};
