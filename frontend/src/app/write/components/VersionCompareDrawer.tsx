/**
 * VersionCompareDrawer.tsx — 版本对比抽屉
 * Standup Workspace v3.0 Phase 8
 */

import React, { useState } from "react";
import type { WorkflowCard } from "../types";
import { getCardSiblings, setMainlineCard } from "../lib/cardTree";
import type { WorkflowSession } from "../types";

interface VersionCompareDrawerProps {
  card: WorkflowCard;
  cardMap: Map<string, WorkflowCard>;
  session: WorkflowSession;
  onClose: () => void;
  onSetMainline: (s: WorkflowSession) => void;
}

export default function VersionCompareDrawer({
  card,
  cardMap,
  session,
  onClose,
  onSetMainline,
}: VersionCompareDrawerProps) {
  const siblings = getCardSiblings(card.id, cardMap).sort((a, b) => a.version - b.version);
  const allVersions = siblings.length > 0 ? siblings : [card];

  const [compareMode, setCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState<WorkflowCard | null>(null);
  const [compareRight, setCompareRight] = useState<WorkflowCard | null>(null);

  const handleSetMainline = (targetCard: WorkflowCard) => {
    const updated = setMainlineCard(session, targetCard.id);
    onSetMainline(updated);
    onClose();
  };

  const handleCompare = (c1: WorkflowCard, c2: WorkflowCard) => {
    setCompareLeft(c1);
    setCompareRight(c2);
    setCompareMode(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="bg-white rounded-t-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">历史版本</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {allVersions.length} 个版本
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {compareMode && compareLeft && compareRight ? (
            /* ── Compare view ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompareMode(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  ← 返回列表
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Left version */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      v{compareLeft.version}
                    </span>
                    {compareLeft.isMainline && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                        当前主线
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {compareLeft.content.slice(0, 300)}
                    {compareLeft.content.length > 300 && "…"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {compareLeft.model && <span>{compareLeft.model}</span>}
                    {compareLeft.latencyMs && <span> · {compareLeft.latencyMs}ms</span>}
                  </div>
                </div>

                {/* Right version */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      v{compareRight.version}
                    </span>
                    {compareRight.isMainline && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                        当前主线
                      </span>
                    )}
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {compareRight.content.slice(0, 300)}
                    {compareRight.content.length > 300 && "…"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {compareRight.model && <span>{compareRight.model}</span>}
                    {compareRight.latencyMs && <span> · {compareRight.latencyMs}ms</span>}
                  </div>
                </div>
              </div>

              {/* Diff highlight: find different lines */}
              <DiffHighlight left={compareLeft.content} right={compareRight.content} />
            </div>
          ) : (
            /* ── Version list ── */
            <div className="space-y-3">
              {allVersions.map((c, idx) => (
                <div
                  key={c.id}
                  className={`bg-white border rounded-2xl p-4 ${
                    c.id === card.id ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          v{c.version}
                        </span>
                        {c.isMainline && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                            当前主线
                          </span>
                        )}
                        {c.id === card.id && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                            当前查看
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                        {c.content.slice(0, 180)}
                        {c.content.length > 180 && "…"}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {c.model && <span>{c.model}</span>}
                        {c.latencyMs && <span>{c.latencyMs}ms</span>}
                        {c.createdAt && (
                          <span>{new Date(c.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {!c.isMainline && (
                      <button
                        onClick={() => handleSetMainline(c)}
                        className="flex-1 py-2 text-xs font-medium bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        设为当前主线
                      </button>
                    )}
                    {allVersions.length >= 2 && idx < allVersions.length - 1 && (
                      <button
                        onClick={() => handleCompare(c, allVersions[idx + 1])}
                        className="flex-1 py-2 text-xs font-medium bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        对比下一版
                      </button>
                    )}
                    {idx > 0 && (
                      <button
                        onClick={() => handleCompare(allVersions[idx - 1], c)}
                        className="flex-1 py-2 text-xs font-medium bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        对比上一版
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Simple diff: highlight lines that differ between two texts */
function DiffHighlight({ left, right }: { left: string; right: string }) {
  const leftLines = left.split("\n").filter(Boolean);
  const rightLines = right.split("\n").filter(Boolean);
  const maxLen = Math.max(leftLines.length, rightLines.length);
  const minLen = Math.min(leftLines.length, rightLines.length);

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl">
      <p className="text-xs text-gray-500 font-medium mb-2">变化预览</p>
      <div className="space-y-1">
        {Array.from({ length: maxLen }).map((_, i) => {
          const l = leftLines[i];
          const r = rightLines[i];
          const changed = l !== r;
          return (
            <div key={i} className={`text-xs font-mono ${changed ? "bg-red-50 text-red-600" : "text-gray-500"}`}>
              {changed ? (
                <>
                  <span className="line-through opacity-60">-{l ?? ""}</span>
                  <br />
                  <span>+{r ?? ""}</span>
                </>
              ) : (
                <span>{l}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
