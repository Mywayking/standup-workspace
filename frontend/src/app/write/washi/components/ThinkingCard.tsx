// ============================================================
// ThinkingCard.tsx — 流式生成中骨架卡
// Standup Workspace v3.0
// ============================================================

import React from "react";

interface Props {
  step?: string;
}

export function ThinkingCard({ step = "正在生成…" }: Props) {
  return (
    <article className="max-w-[800px] border border-black/16 rounded-3xl bg-[#FBF8F0]/96 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-black/10">
        <div className="flex items-center gap-3">
          {/* Spinner */}
          <div className="w-5 h-5 rounded-full border-2 border-[#A94737]/30 border-t-[#A94737] animate-spin" />
          <div>
            <p className="text-[11px] text-[#C5BAAA] tracking-widest mb-1">GENERATING</p>
            <h3 className="text-[16px] font-semibold text-[#25231F]">{step}</h3>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-3">
        {/* Skeleton lines */}
        {[100, 85, 92, 70, 88, 60].map((w, i) => (
          <div key={i}>
            <div
              className="h-4 rounded-full bg-[#F0E7D8] animate-pulse"
              style={{ width: `${w}%` }}
            />
          </div>
        ))}
      </div>
    </article>
  );
}
