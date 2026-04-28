// ============================================================
// hooks/useWriteSession.ts — 会话状态管理
// Standup Workspace v3.0
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import type { WorkSession, WorkCard } from "../types";
import { newWorkSession, generateSessionTitle } from "../types";
import {
  loadSessions,
  saveSessions,
  loadActive,
  saveActive,
  saveSession,
  deleteSession,
} from "./useLocalWriteStore";

// ─── Cloud Sync Config ───────────────────────────────────────

const API_BASE = (typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_BASE || "")
  : "");

// ─── Cloud Sync Helpers (fire-and-forget, silent fail) ───────

function syncCardToCloud(card: WorkCard) {
  if (!API_BASE) return;
  // Defer to avoid blocking UI; read fresh state from sessions array via setTimeout
  setTimeout(() => {
    fetch(`${API_BASE}/api/write/sessions/${card.sessionId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: card.id,
        session_id: card.sessionId,
        parent_id: card.sourcePath?.length > 1 ? card.sourcePath[card.sourcePath.length - 2] : null,
        type: card.type,
        title: card.title,
        content: card.content,
        structured_data: card.rawData ? JSON.stringify(card.rawData) : null,
        source_path: card.sourcePath ? JSON.stringify(card.sourcePath) : null,
        is_selected: 0,
        is_mainline: 1,
        version: 1,
        model: card.meta?.model || null,
        provider: card.meta?.provider || null,
        latency_ms: card.meta?.latencyMs || null,
        token_usage: null,
      }),
    }).catch(() => { /* silent fail */ });
  }, 0);
}

function syncSessionToCloud(session: WorkSession) {
  if (!API_BASE) return;
  setTimeout(() => {
    fetch(`${API_BASE}/api/write/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: session.title,
        current_step: session.status,
        save_status: "saved_cloud",
        sync_status: "synced",
      }),
    }).catch(() => { /* silent fail */ });
  }, 0);
}

// ─── Hook ────────────────────────────────────────────────────

export function useWriteSession() {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 初始化加载 ─────────────────────────────────────────

  useEffect(() => {
    setSessions(loadSessions());
    setActiveSessionIdState(loadActive());
  }, []);

  // ── 主动话 ID 持久化 ────────────────────────────────────

  function setActiveSessionId(id: string | null) {
    setActiveSessionIdState(id);
    saveActive(id);
  }

  // ── 延迟保存（防抖） ───────────────────────────────────

  function scheduleSave(newSessions: WorkSession[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSessions(newSessions);
    }, 500);
  }

  // ── 创建新会话 ─────────────────────────────────────────

  const createSession = useCallback(
    (sourceInput: string): WorkSession => {
      const session = newWorkSession(sourceInput);
      setSessions((prev) => {
        const next = [session, ...prev].slice(0, 100);
        scheduleSave(next);
        return next;
      });
      setActiveSessionId(session.id);
      syncSessionToCloud(session);
      return session;
    },
    []
  );

  // ── 确保有活跃会话（空状态时自动创建） ─────────────────

  const createSessionIfNeeded = useCallback((): WorkSession => {
    if (!activeSessionId) {
      return createSession("");
    }
    const existing = sessions.find((s) => s.id === activeSessionId);
    if (existing) return existing;
    return createSession("");
  }, [activeSessionId, sessions, createSession]);

  // ── 获取活跃会话 ───────────────────────────────────────

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // ── 获取活跃卡片 ───────────────────────────────────────

  const activeCards: WorkCard[] = activeSession?.cards ?? [];

  // ── 添加卡片 ────────────────────────────────────────────

  const addCard = useCallback(
    (card: WorkCard) => {
      // Resolve the target session: use card.sessionId if it's a valid non-empty
      // string, otherwise fall back to activeSessionId.
      // This handles the race where the premise card is created before
      // the activeSessionId has been set by the material card creation.
      const targetSessionId = card.sessionId || activeSessionId;
      setSessions((prev) => {
        // If no valid targetSessionId, nothing to do
        if (!targetSessionId) return prev;
        const next = prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          const updated: WorkSession = {
            ...s,
            cards: [...s.cards, { ...card, sessionId: targetSessionId }],
            updatedAt: Date.now(),
          };
          saveSession(updated);
          // Cloud sync (non-blocking, silent fail)
          const addedCard = updated.cards[updated.cards.length - 1];
          syncCardToCloud(addedCard);
          syncSessionToCloud(updated);
          return updated;
        });
        scheduleSave(next);
        return next;
      });
    },
    [activeSessionId]
  );

  // ── 更新卡片 ────────────────────────────────────────────

  const updateCard = useCallback(
    (sessionId: string, cardId: string, updates: Partial<WorkCard>) => {
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== sessionId) return s;
          const updated: WorkSession = {
            ...s,
            cards: s.cards.map((c) =>
              c.id === cardId ? { ...c, ...updates, updatedAt: Date.now() } : c
            ),
            updatedAt: Date.now(),
          };
          saveSession(updated);
          return updated;
        });
        scheduleSave(next);
        return next;
      });
    },
    []
  );

  // ── 删除会话 ───────────────────────────────────────────

  const removeSession = useCallback(
    (id: string) => {
      deleteSession(id);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        scheduleSave(next);
        return next;
      });
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    },
    [activeSessionId]
  );

  // ── 重命名会话 ─────────────────────────────────────────

  const renameSession = useCallback(
    (id: string, title: string) => {
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== id) return s;
          const updated: WorkSession = { ...s, title, updatedAt: Date.now() };
          saveSession(updated);
          syncSessionToCloud(updated);
          return updated;
        });
        scheduleSave(next);
        return next;
      });
    },
    []
  );

  // ── 切换活跃会话 ───────────────────────────────────────

  const switchSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
    },
    []
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    activeCards,
    createSession,
    createSessionIfNeeded,
    addCard,
    updateCard,
    removeSession,
    renameSession,
    setActiveSessionId: switchSession,
  };
}
