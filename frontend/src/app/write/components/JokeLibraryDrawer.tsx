"use client";

import React, { useState, useEffect } from "react";
import type { WorkflowSession } from "../types";
import {
  SCRIPT_STATUS_LABELS,
  NEXT_ACTION_BY_STATUS,
} from "../types";

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

  const filtered = filter === "all"
    ? sessions
    : sessions.filter((s) => s.scriptStatus === filter);

  const counts: Record<string, number> = { all: sessions.length };
  for (const s of sessions) {
    counts[s.scriptStatus] = (counts[s.scriptStatus] ?? 0) + 1;
  }

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
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            ✕
          </button>
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
          {filtered.length === 0 ? (
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
                  <div className="flex gap-1 shrink-0">
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
          )}
        </div>
      </div>
    </>
  );
}
