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

  const counts: Record<string, number> = { all: sessions.length };
  for (const s of sessions) {
    counts[s.scriptStatus] = (counts[s.scriptStatus] ?? 0) + 1;
  }

  const handleAddToSet = (session: WorkflowSession, setId?: string) => {
    if (setId) {
      // Add to existing set
      const updated = specialSets.map((s) =>
        s.id === setId
          ? { ...s, scriptIds: [...s.scriptIds, session.id], updatedAt: new Date().toISOString() }
          : s
      );
      setSpecialSets(updated);
      saveSpecialSets(updated);
    } else {
      // Show set picker
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
            {/* 专场 tab (Phase 11) */}
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
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {/* Special sets view (Phase 11) */}
          {showSets && (
            <>
              {/* Create new set */}
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
                        <p className="text-xs text-indigo-500 mt-0.5">
                          {s.scriptIds.length} 个段子
                        </p>
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

          {/* Normal session list */}
          {!showSets && (filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {filter === "all" ? "还没有创作记录" : "暂无此类段子"}
            </div>
          ) : (
            filtered.map((session) => (
              <div
                key={session.id}
                className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
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
                  <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                    {/* 加入专场 action for mature scripts (Phase 11) */}
                    {session.scriptStatus === "mature" && (
                      <button
                        onClick={() => handleAddToSet(session)}
                        className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="加入专场"
                      >
                        +专场
                      </button>
                    )}
                    <button
                      onClick={() => onRestore(session)}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      继续
                    </button>
                    <button
                      onClick={() => onDelete(session.id)}
                      className="text-xs px-2 py-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
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
            ))
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

/** Create new special set form */
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

/** Modal to add session to a special set */
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
