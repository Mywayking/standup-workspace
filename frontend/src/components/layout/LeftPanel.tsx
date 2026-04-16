"use client";

import type { Script, SegmentDetail } from "@/types";

interface LeftPanelProps {
  segments: SegmentDetail[];
  selectedSegmentId: number | null;
  onSelectSegment: (id: number) => void;
  starredOnly?: boolean;
  onToggleStarredOnly?: (v: boolean) => void;
}

export function LeftPanel({
  segments,
  selectedSegmentId,
  onSelectSegment,
  starredOnly,
  onToggleStarredOnly,
}: LeftPanelProps) {
  const visible = starredOnly ? segments.filter((s) => s.starred) : segments;

  return (
    <aside className="w-56 border-r border-gray-200 flex flex-col bg-gray-50 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          段落列表
        </span>
        <button
          onClick={() => onToggleStarredOnly?.(!starredOnly)}
          className={`text-xs px-2 py-0.5 rounded ${starredOnly ? "bg-yellow-100 text-yellow-700" : "text-gray-400 hover:text-gray-600"}`}
          title="只看收藏"
        >
          {starredOnly ? "⭐" : "☆"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {visible.length === 0 && (
          <p className="text-xs text-gray-400 p-2">暂无段落</p>
        )}
        {visible.map((seg) => (
          <button
            key={seg.id}
            onClick={() => onSelectSegment(seg.id)}
            className={[
              "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
              selectedSegmentId === seg.id
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-gray-100 text-gray-600",
            ].join(" ")}
          >
            <span className="font-mono text-gray-400 mr-1">#{seg.index + 1}</span>
            {seg.raw_text.slice(0, 40)}
            {seg.raw_text.length > 40 ? "…" : ""}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-400">
        {visible.length} / {segments.length} 段落
        {starredOnly && ` · ⭐收藏`}
      </div>
    </aside>
  );
}
