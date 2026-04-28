// ============================================================
// EmptyState.tsx — 空状态
// Standup Workspace v3.0
// ============================================================

import React from "react";

interface Props {
  onTryExample?: () => void;
}

const EXAMPLE_MATERIAL = "老板说我们要有主人翁意识，但公司裁员的时候又说我是外包。这个素材怎么写？";

export function EmptyState({ onTryExample }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      {/* Text-based illustration */}
      <div className="mb-6 text-[48px] leading-none text-[#C5BAAA]" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto">
          <rect x="8" y="12" width="48" height="40" rx="6" fill="#F0E7D8" stroke="#C5BAAA" strokeWidth="2"/>
          <line x1="16" y1="24" x2="48" y2="24" stroke="#C5BAAA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="32" x2="40" y2="32" stroke="#C5BAAA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="40" x2="36" y2="40" stroke="#C5BAAA" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="48" cy="48" r="12" fill="#A94737"/>
          <path d="M44 48h8M48 44v8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <h2
        className="text-[22px] font-semibold text-[#25231F] mb-3 leading-snug"
        style={{ fontFamily: "STSong, Songti SC, serif" }}
      >
        还没有创作记录
      </h2>

      <p className="text-[14px] text-[#8A8174] leading-relaxed max-w-[280px] mb-6">
        把一个念头、一段素材、一句梗写下来，AI 会帮你找到角度和前提。
      </p>

      {onTryExample && (
        <div className="w-full max-w-[280px]">
          <p className="text-[12px] text-[#C5BAAA] mb-2">试试这个例子：</p>
          <button
            onClick={onTryExample}
            className="
              w-full text-left px-4 py-3 rounded-2xl
              border border-black/10 bg-white/40
              text-[13px] text-[#8A8174] leading-relaxed
              hover:bg-white/60 transition-colors
            "
          >
            "{EXAMPLE_MATERIAL.slice(0, 50)}…"
          </button>
          <button
            onClick={onTryExample}
            className="
              w-full mt-3 py-3 rounded-2xl
              bg-[#25231F] text-[#FBF8F0]
              text-sm font-semibold
              hover:bg-[#3a3832] transition-colors
            "
          >
            用这个例子试试
          </button>
        </div>
      )}
    </div>
  );
}
