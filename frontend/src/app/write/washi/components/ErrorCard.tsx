// ============================================================
// ErrorCard.tsx — 错误卡片
// Standup Workspace v3.0
// ============================================================

import React from "react";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: Props) {
  return (
    <article className="max-w-[800px] border-2 border-[#A94737]/40 rounded-3xl bg-[#FFFAF4] overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[#A94737]/20 flex items-center gap-3">
        <span className="text-[#A94737] text-lg">⚠</span>
        <div>
          <p className="text-[11px] text-[#A94737] tracking-widest mb-0.5">ERROR</p>
          <h3 className="text-[15px] font-semibold text-[#A94737]">生成失败</h3>
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-[13px] text-[#8A8174] leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <div className="px-4 py-3 border-t border-[#A94737]/15 flex gap-2">
          <button
            onClick={onRetry}
            className="
              text-[13px] px-4 py-2 rounded-full
              bg-[#A94737] text-white
              hover:bg-[#8f3a2c] transition-colors
            "
          >
            重试
          </button>
          <p className="text-[11px] text-[#C5BAAA] self-center">
            输入内容已保留
          </p>
        </div>
      )}
    </article>
  );
}
