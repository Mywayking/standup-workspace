// ============================================================
// hooks/useLocalWriteStore.ts — localStorage 封装（含迁移）
// Standup Workspace v3.0
// ============================================================

import type { WorkSession } from "../types";

// ─── Storage Keys ────────────────────────────────────────────

// 新版 Washi 存储键
const STORAGE_KEY = "standup_write_v1_sessions";
const ACTIVE_KEY   = "standup_write_v1_active";

// 旧版 GuidedWriteClient 存储键（用于迁移）
const OLD_SESSIONS_KEY = "standup_v3_sessions";
const OLD_ACTIVE_KEY   = "standup_v3_active";

// ─── 加载 ────────────────────────────────────────────────────

export function loadSessions(): WorkSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateFromOld();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: WorkSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 100)));
  } catch {}
}

export function loadActive(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActive(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

// ─── 单条 Session 操作 ──────────────────────────────────────

export function saveSession(session: WorkSession): void {
  const all = loadSessions();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.unshift(session);
  saveSessions(all);
}

export function deleteSession(id: string): void {
  const all = loadSessions().filter((s) => s.id !== id);
  saveSessions(all);
  if (loadActive() === id) saveActive(null);
}

// ─── 迁移旧版数据 ──────────────────────────────────────────

function migrateFromOld(): WorkSession[] {
  if (typeof window === "undefined") return [];
  try {
    const oldRaw = localStorage.getItem(OLD_SESSIONS_KEY);
    if (!oldRaw) return [];

    const oldSessions = JSON.parse(oldRaw) as Array<{
      id: string;
      title: string;
      sourceInput: string;
      inputType?: string | null;
      currentStep?: string;
      scriptStatus?: string;
      cards?: Array<{
        id: string;
        type: string;
        title?: string;
        content: string;
        role?: string;
        sourcePath?: string[];
        createdAt?: string;
        updatedAt?: string;
        model?: string;
        provider?: string;
        latencyMs?: number;
      }>;
      createdAt?: string;
      updatedAt?: string;
    }>;

    const migrated: WorkSession[] = oldSessions.slice(0, 50).map((old) => ({
      id: old.id,
      title: old.title || old.sourceInput?.slice(0, 20) || "未命名",
      status: mapScriptStatus(old.scriptStatus),
      sourceInput: old.sourceInput || "",
      inputType: old.inputType ?? null,
      createdAt: old.createdAt ? new Date(old.createdAt).getTime() : Date.now(),
      updatedAt: old.updatedAt ? new Date(old.updatedAt).getTime() : Date.now(),
      cards: (old.cards || []).map((card) => ({
        id: card.id,
        sessionId: old.id,
        type: mapCardType(card.type),
        role: (card.role as "user" | "assistant" | "system") ?? "assistant",
        title: card.title || card.type,
        content: card.content,
        sourcePath: card.sourcePath || [],
        createdAt: card.createdAt ? new Date(card.createdAt).getTime() : Date.now(),
        updatedAt: card.updatedAt ? new Date(card.updatedAt).getTime() : undefined,
        meta: {
          model: card.model,
          provider: card.provider,
          latencyMs: card.latencyMs,
        },
      })),
    }));

    if (migrated.length > 0) {
      saveSessions(migrated);
      // 标记迁移完成，避免重复
      try {
        localStorage.setItem("standup_write_v1_migrated", "1");
      } catch {}
    }

    return migrated;
  } catch {
    return [];
  }
}

function mapScriptStatus(s?: string): WorkSession["status"] {
  const map: Record<string, WorkSession["status"]> = {
    idea: "idea",
    premise: "premise",
    draft: "draft",
    performable: "performable",
    performed: "performed",
    mature: "mature",
  };
  return map[s ?? ""] ?? "idea";
}

function mapCardType(t: string): WorkSession["cards"][0]["type"] {
  const map: Record<string, WorkSession["cards"][0]["type"]> = {
    material: "material",
    premise: "premise",
    joke_to_premise: "joke_to_premise",
    angles: "angle",
    angle: "angle",
    draft: "draft",
    rewrite: "rewrite",
    feedback: "feedback",
  };
  return map[t] ?? "material";
}
