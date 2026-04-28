// ============================================================
// ChatMessage.tsx — 聊天消息（用户 / AI）
// Standup Workspace v3.0
// ============================================================

import React from "react";

interface Props {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessage({ role, content, timestamp }: Props) {
  const isUser = role === "user";

  return (
    <div className="flex items-start gap-2.5">
      {/* Avatar */}
      <div
        className={`
          w-[30px] h-[30px] rounded-full shrink-0
          flex items-center justify-center text-[12px] font-medium
          ${isUser
            ? "bg-[#F0E7D8] text-[#8A8174]"
            : "bg-[rgba(169,71,55,0.07)] text-[#A94737]"
          }
        `}
      >
        {isUser ? "我" : "✦"}
      </div>

      {/* Bubble */}
      <div
        className={`
          max-w-[760px] px-3.5 py-3 rounded-2xl
          text-[13px] leading-relaxed
          ${isUser
            ? "bg-[rgba(104,113,95,0.06)] border border-black/8"
            : "bg-white/50 border border-black/10"
          }
          text-[#25231F]
        `}
      >
        {content}
      </div>

      {/* Timestamp */}
      {timestamp && (
        <span className="text-[11px] text-[#C5BAAA] self-end shrink-0">
          {formatTime(timestamp)}
        </span>
      )}
    </div>
  );
}
