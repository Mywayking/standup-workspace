"use client";

import React, { useState, useEffect } from "react";
import type { WorkflowSession, SpecialSet } from "../types";
import {
  SCRIPT_STATUS_LABELS,
  NEXT_ACTION_BY_STATUS,
} from "../types";

const SPECIAL_SETS_KEY = "standup_v3_special_sets";

function loadSpecialSets(): SpecialSet[] {
  try {
    const raw = localStorage.getItem(SPECIAL_SETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSpecialSets(sets: SpecialSet[]) {
  try { localStorage.setItem(SPECIAL_SETS_KEY, JSON.stringify(sets)); } catch {}
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessions: WorkflowSession[];
  onRestore: (session: WorkflowSession) => void;
  onDelete: (sessionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  idea:        "bg-gray-100 text-gray-600",
  premise:     "bg-blue-100 text-blue-700",
  draft:       "bg-amber-100 text-amber-700",
  performable: "bg-green-100 text-green-700",
  performed:   "bg-purple-100 text-purple-700",
  mature:      "bg-indigo-100 text-indigo-700",
};

// ─── Session item sub-component ──────────────────────────────────────────────

interface SessionItemProps {
  session: WorkflowSession;
  onRestore: (s: WorkflowSession) => void;
  onDelete: (id: string) => void;
  onAddToSet: (s: WorkflowSession) => void;
}

function SessionItem({ session, onRestore, onDelete, onAddToSet }: SessionItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
      onBlur={() => setShowMenu(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 truncate">
            {session.title || session.sourceInput.slice(0, 20) || "未命名"}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                STATUS_COLORS[session.scriptStatus] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {SCRIPT_STATUS_LABELS[session.scriptStatus]}
            </span>
            <span className="text-xs text-gray-400">
              → {NEXT_ACTION_BY_STATUS[session.scriptStatus]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* 加入专场 action for mature scripts */}
          {session.scriptStatus === "mature" && (
            <button
              onClick={() => onAddToSet(session)}
              className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
              title="加入专场"
            >
              +专场
            </button>
          )}
          {/* 继续 — primary style */}
          <button
            onClick={() => onRestore(session)}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            继续
          </button>
          {/* More menu (delete) */}
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              ⋮
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 w-28">
                <button
                  onClick={() => { onDelete(session.id); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  删除记录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        {new Date(session.updatedAt).toLocaleDateString("zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

// ─── Group sessions by date ────────────────────────────────────────────────────

function groupSessions(list: WorkflowSession[]) {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterdayStr = new Date(now.getTime() - 86400000).toDateString();
  const groups: { label: string; sessions: WorkflowSession[] }[] = [];
  let current: { label: string; sessions: WorkflowSession[] } | null = null;

  for (const s of list) {
    const d = new Date(s.updatedAt);
    const dStr = d.toDateString();
    let label = d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    if (dStr === todayStr) label = "今天";
    else if (dStr === yesterdayStr) label = "昨天";
    if (!current || current.label !== label) {
      current = { label, sessions: [] };
      groups.push(current);
    }
    current.sessions.push(s);
  }
  return groups;
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export default function JokeLibraryDrawer({
  open,
  onClose,
  sessions,
  onRestore,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [specialSets, setSpecialSets] = useState<SpecialSet[]>([]);
  const [showSets, setShowSets] = useState(false);
  const [addToSetSession, setAddToSetSession] = useState<WorkflowSession | null>(null);

  useEffect(() => {
    if (open) setSpecialSets(loadSpecialSets());
  }, [open]);

  const filtered = filter === "all"
    ? sessions
    : sessions.filter((s) => s.scriptStatus === filter);

  const grouped = groupSessions(filtered);

  const counts: Record<string, number> = { all: sessions.length };
  for (const s of sessions) {
    counts[s.scriptStatus] = (counts[s.scriptStatus] ?? 0) + 1;
  }

  const handleAddToSet = (session: WorkflowSession, setId?: string) => {
    if (setId) {
      const updated = specialSets.map((s) =>
        s.id === setId
          ? { ...s, scriptIds: [...s.scriptIds, session.id], updatedAt: new Date().toISOString() }
          : s
      );
      setSpecialSets(updated);
      saveSpecialSets(updated);
    } else {
      setAddToSetSession(session);
    }
  };

  const handleCreateSet = (title: string) => {
    if (!addToSetSession) return;
    const newSet: SpecialSet = {
      id: genId("set"),
      title,
      scriptIds: [addToSetSession.id],
      totalDurationMin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...specialSets, newSet];
    setSpecialSets(updated);
    saveSpecialSets(updated);
    setAddToSetSession(null);
  };

  const handleEmptyStateExample = () => {
    const example = "我最近发现公司开会越来越像开放麦，大家都在等一个人讲完废话。";
    const now = new Date().toISOString();
    const fakeSession: WorkflowSession = {
      id: genId("session"),
      title: example.slice(0, 20) + "…",
      sourceInput: example,
      inputType: null,
      currentStep: "input",
      scriptStatus: "idea",
      mode: "guided",
      saveStatus: "idle",
      syncStatus: "local_only",
      rootCardIds: [],
      cards: [],
      createdAt: now,
      updatedAt: now,
    };
    onRestore(fakeSession);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl
          transition-transform duration-300 ease-out
          max-h-[85vh] flex flex-col
          ${open ? "translate-y-0" : "translate-y-full"}
          lg:bottom-auto lg:top-20 lg:right-4 lg:left-auto lg:w-80 lg:rounded-2xl lg:shadow-xl
        `}
      >
        {/* Handle / Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📚</span>
            <span className="font-bold text-gray-800">段子库</span>
            <span className="text-xs text-gray-400">{sessions.length} 条</span>
          </div>
          <div className="flex items-center gap-1">
            {/* 专场 tab */}
            <button
              onClick={() => setShowSets((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                showSets ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              专场 ({specialSets.length})
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="px-5 py-3 border-b border-gray-50 flex gap-2 flex-wrap shrink-0">
          {(["all", "idea", "premise", "draft", "performable", "performed", "mature"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "全部" : SCRIPT_STATUS_LABELS[f]}
              {counts[f] != null && counts[f] > 0 && ` (${counts[f]})`}
            </button>
          ))}
        </div>

        {/* Session list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">

          {/* Special sets view */}
          {showSets && (
            <>
              <CreateSetForm onCreate={handleCreateSet} />
              {specialSets.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  还没有专场，创建一个吧
                </div>
              ) : (
                specialSets.map((s) => (
                  <div key={s.id} className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-indigo-800">{s.title}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">{s.scriptIds.length} 个段子</p>
                      </div>
                      <button
                        onClick={() => {
                          const updated = specialSets.filter((x) => x.id !== s.id);
                          setSpecialSets(updated);
                          saveSpecialSets(updated);
                        }}
                        className="text-xs text-indigo-400 hover:text-red-500"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Empty state */}
          {!showSets && filtered.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500 font-medium mb-1">还没有创作记录</p>
              <p className="text-xs text-gray-400 mb-4">你可以先丢一段生活素材进来，比如：</p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-left mb-4">
                <p className="text-xs text-gray-600 italic">
                  "我最近发现公司开会越来越像开放麦，大家都在等一个人讲完废话。"
                </p>
              </div>
              <button
                onClick={handleEmptyStateExample}
                className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                用这个例子试试
              </button>
            </div>
          )}

          {/* Grouped session list */}
          {!showSets && grouped.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    onRestore={onRestore}
                    onDelete={onDelete}
                    onAddToSet={handleAddToSet}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add to set modal */}
        {addToSetSession && (
          <AddToSetModal
            session={addToSetSession}
            specialSets={specialSets}
            onClose={() => setAddToSetSession(null)}
            onSelectSet={(setId) => {
              handleAddToSet(addToSetSession, setId);
              setAddToSetSession(null);
            }}
            onCreateSet={handleCreateSet}
          />
        )}
      </div>
    </>
  );
}

// ─── CreateSetForm ────────────────────────────────────────────────────────────

function CreateSetForm({ onCreate }: { onCreate: (title: string) => void }) {
  const [title, setTitle] = useState("");

  return (
    <div className="flex gap-2 mb-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="新专场名称…"
        className="flex-1 text-sm px-3 py-2 border border-indigo-200 rounded-xl outline-none focus:border-indigo-400"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) {
            onCreate(title.trim());
            setTitle("");
          }
        }}
      />
      <button
        onClick={() => {
          if (title.trim()) {
            onCreate(title.trim());
            setTitle("");
          }
        }}
        className="text-xs px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
      >
        创建
      </button>
    </div>
  );
}

// ─── AddToSetModal ────────────────────────────────────────────────────────────

function AddToSetModal({
  session,
  specialSets,
  onClose,
  onSelectSet,
  onCreateSet,
}: {
  session: WorkflowSession;
  specialSets: SpecialSet[];
  onClose: () => void;
  onSelectSet: (setId: string) => void;
  onCreateSet: (title: string) => void;
}) {
  const [newSetTitle, setNewSetTitle] = useState("");

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-72 p-5 space-y-3">
        <p className="text-sm font-medium text-gray-800">加入专场</p>
        <p className="text-xs text-gray-500 truncate">{session.title || session.sourceInput.slice(0, 30)}</p>

        {specialSets.length > 0 && (
          <div className="space-y-1.5">
            {specialSets.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSet(s.id)}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                {s.title} ({s.scriptIds.length}个)
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newSetTitle}
            onChange={(e) => setNewSetTitle(e.target.value)}
            placeholder="新建专场…"
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSetTitle.trim()) {
                onCreateSet(newSetTitle.trim());
              }
            }}
          />
          <button
            onClick={() => newSetTitle.trim() && onCreateSet(newSetTitle.trim())}
            className="text-xs px-3 py-2 bg-indigo-600 text-white rounded-xl"
          >
            新建
          </button>
        </div>

        <button onClick={onClose} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
          取消
        </button>
      </div>
    </div>
  );
}
