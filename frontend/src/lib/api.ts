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

export interface StreamEvents {
  done: { type: "done"; result: unknown; _meta?: Record<string, unknown> };
  error: { type: "error"; error: string; error_code?: string; retryable?: boolean; _meta?: Record<string, unknown> };
  progress: { type: "progress"; phase?: string; message: string; status?: string; model?: string; attempt?: number };
  meta: { type: "meta"; selected_model: string; provider?: string; request_id?: string; attempt_count: number; total_latency_ms: number; scene?: string };
  token: string;
  [key: string]: unknown;
}

/**
 * SSE 流式 POST 请求。
 * onChunk(data) 每收到一个 data 事件解析后调用。
 * onEvent(event, data) 处理具名事件（progress | analysis | done | error | meta）。
 *
 * timeoutMs 默认 60 秒。
 * AbortError → 抛出 "请求已取消或超时"。
 * reader 结束后无 done/error → onEvent("error", { error: "连接已结束，但未收到分析结果" })
 */
export function streamPost<T extends StreamEvents>(
  path: string,
  body: Record<string, string>,
  opts?: {
    onChunk?: (data: string, event: string) => void;
    onEvent?: (event: string, data: unknown) => void;
    onToken?: (token: string) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<void> {
  const { onChunk, onEvent, onToken, signal, timeoutMs = 60_000 } = opts ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const combinedSignal = signal
    ? (() => {
        const s = signal;
        s.addEventListener("abort", () => controller.abort());
        return controller.signal;
      })()
    : controller.signal;

  let gotFinalEvent = false;

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
          // Standardized token format: {"type":"token","content":"..."}
          // For token events, pass content string to both onToken and onEvent
          if (pendingEvent === "token" && typeof data === "object" && data !== null && "type" in data && (data as {type?:string}).type === "token" && "content" in data) {
            const content = (data as {content: string}).content;
            onToken?.(content);
            onEvent?.("token", content);
          } else {
            onEvent?.(pendingEvent, data);
          }
          // Track if we got a terminal event
          if (pendingEvent === "done" || pendingEvent === "error") {
            gotFinalEvent = true;
          }
        } catch { /* 非 JSON 数据，onEvent 已在上面通过 onChunk 处理 */ }
      }
    }

    // Safety net: reader finished but no done/error received
    if (!gotFinalEvent) {
      onEvent?.("error", {
        error: "连接已结束，但未收到分析结果，请重试",
      });
    }
  });
}

export const writeApi = {
  /** 提炼前提（流式）— 新统一端点 */
  extractPremise: (text: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/write/premise/stream", { text }, opts),

  /** 梗写前提（流式）— 新统一端点 */
  jokeToPremise: (text: string, topic?: string, style?: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/write/joke-to-premise/stream", { text, ...(topic ? { topic } : {}), ...(style ? { style } : {}) }, opts),

  /** 找角度（流式）— 新统一端点 */
  findAngles: (premise: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/write/angles/stream", { premise }, opts),

  /** 改稿分析（流式）— 新统一端点 */
  analyze: (text: string, opts?: Parameters<typeof streamPost>[2]) =>
    streamPost("/api/write/rewrite/stream", { text }, opts),
};

// ─── Input Detection API ──────────────────────────────────────────────────────

export interface DetectInputResult {
  input_type: "material" | "premise" | "punchline" | "draft";
  confidence: number;
  reason: string;
  recommended_next_step: "提炼前提" | "找角度" | "梗写前提" | "改稿";
}

export const detectInputApi = {
  detect: (text: string) =>
    api<DetectInputResult>("/api/detect-input", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

// ─── Stage Version API ───────────────────────────────────────────────────────

export interface StageVersionAnnotation {
  type: "pause" | "stress" | "laugh" | "callback";
  position: number;
  text: string;
  note: string;
}

export interface StageVersionStats {
  word_count: number;
  estimated_duration: string;
  punchline_count: number;
}

export interface StageVersionResult {
  stage_version: string;
  annotations: StageVersionAnnotation[];
  stats: StageVersionStats;
}

export const stageVersionApi = {
  stream: (
    text: string,
    opts?: {
      onChunk?: (data: string, event: string) => void;
      onEvent?: (event: string, data: unknown) => void;
      onToken?: (token: string) => void;
      signal?: AbortSignal;
      timeoutMs?: number;
    }
  ) => streamPost("/api/stage-version/stream", { text }, opts),
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  profile: {
    displayName: string;
    username: string;
    avatarUrl: string;
    bio: string;
    role: string;
  } | null;
}

export interface MeResponse {
  loggedIn: boolean;
  user: AuthUser | null;
}

export const authApi = {
  me: (): Promise<MeResponse> =>
    fetch("/api/auth/me").then(r => r.json()),

  register: (payload: {
    identifier: string;
    identifierType: "email" | "phone";
    password: string;
    confirmPassword: string;
  }): Promise<{ success: boolean; user?: AuthUser; detail?: string }> =>
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "注册失败");
      return data;
    }),

  login: (payload: {
    identifier: string;
    password: string;
  }): Promise<{ success: boolean; user?: AuthUser; detail?: string }> =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "登录失败");
      return data;
    }),

  logout: (): Promise<{ success: boolean }> =>
    fetch("/api/auth/logout", { method: "POST" }).then(r => r.json()),

  forgotPassword: (payload: {
    identifier: string;
    identifierType: "email";
  }): Promise<{ success: boolean; message?: string; detail?: string }> =>
    fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "请求失败");
      return data;
    }),

  resetPassword: (payload: {
    tokenId: number;
    token: string;
    newPassword: string;
  }): Promise<{ success: boolean; message?: string; detail?: string }> =>
    fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "重置失败");
      return data;
    }),

  updateProfile: (payload: {
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    bio?: string;
  }): Promise<{ success: boolean; profile: AuthUser["profile"] }> =>
    fetch("/api/auth/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "更新失败");
      return data;
    }),

  updateCreatorProfile: (payload: {
    creator_type?: string;
    topics?: string[];
    humor_styles?: string[];
    stage_experience?: string;
    preferred_output?: string;
    avoid_topics?: string[];
  }): Promise<{ success: boolean }> =>
    fetch("/api/auth/users/creator-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "更新失败");
      return data;
    }),
};
