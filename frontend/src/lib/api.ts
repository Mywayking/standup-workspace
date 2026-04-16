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
