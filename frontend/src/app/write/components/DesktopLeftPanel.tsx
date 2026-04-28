"use client";

import React, { useState } from "react";
import type { WorkflowSession } from "../types";
import {
  SCRIPT_STATUS_LABELS,
  NEXT_ACTION_BY_STATUS,
} from "../types";

interface Props {
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

export default function DesktopLeftPanel({ sessions, onRestore, onDelete }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all"
    ? sessions.slice(0, 10)
    : sessions.filter((s) => s.scriptStatus === filter).slice(0, 10);

  const counts: Record<string, number> = { all: sessions.length };
  for (const s of sessions) {
    counts[s.scriptStatus] = (counts[s.scriptStatus] ?? 0) + 1;
  }

  return (
    <div className="desktop-left-panel flex flex-col bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">📚</span>
          <span className="font-bold text-gray-800 text-sm">段子库</span>
          <span className="text-xs text-gray-400">{sessions.length}</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-3 py-2 border-b border-gray-50 shrink-0 flex gap-1.5 flex-wrap">
        {(["all", "idea", "premise", "draft", "performable", "performed", "mature"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
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
      <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {filter === "all" ? "暂无创作记录" : "暂无此类段子"}
          </div>
        ) : (
          filtered.map((session) => (
            <div
              key={session.id}
              className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {session.title || session.sourceInput.slice(0, 18) || "未命名"}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span
                      className={`text-xs px-1 py-0.5 rounded-full ${
                        STATUS_COLORS[session.scriptStatus] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {SCRIPT_STATUS_LABELS[session.scriptStatus]}
                    </span>
                    <span className="text-xs text-gray-400 truncate max-w-20">
                      → {NEXT_ACTION_BY_STATUS[session.scriptStatus]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => onRestore(session)}
                    className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    继续
                  </button>
                  <button
                    onClick={() => onDelete(session.id)}
                    className="text-xs px-1 py-0.5 text-gray-400 hover:text-red-500 transition-colors text-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
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
  );
}