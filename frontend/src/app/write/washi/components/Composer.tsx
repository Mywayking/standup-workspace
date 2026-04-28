// ============================================================
// Composer.tsx — 底部输入框
// Standup Workspace v3.0
// ============================================================

import React, { useState, useRef, useCallback } from "react";

interface Props {
  disabled?: boolean;
  onSubmit: (text: string) => void;
  placeholder?: string;
}

const QUICK_LABELS = ["输入素材", "提炼前提", "找角度", "开放麦口语", "记录反馈"];

export function Composer({ disabled, onSubmit, placeholder = "写下一个素材、一个念头，或者一句还没成熟的梗。" }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const value = text.trim();
    if (!value || disabled) return;
    onSubmit(value);
    setText("");
    textareaRef.current?.focus();
  }, [text, disabled, onSubmit]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  function autoFill(label: string) {
    const prefix = label === "输入素材" ? ""
      : label === "提炼前提" ? "前提："
      : label === "找角度" ? "找角度："
      : label === "开放麦口语" ? "改成上台版："
      : "演出反馈：";
    setText((prev) => (prev ? prev : prefix));
    textareaRef.current?.focus();
  }

  return (
    <footer
      className="
        sticky bottom-0 border-t border-black/10
        bg-[#FBF8F0]/95 px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]
        md:px-4 md:pt-4
      "
    >
      {/* Quick chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-hide">
        {QUICK_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => autoFill(label)}
            className="
              shrink-0 rounded-full border border-black/10
              px-3 py-1.5 text-[12px] text-[#8A8174]
              hover:bg-black/5 transition-colors
            "
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div
        className="
          grid grid-cols-[1fr_auto] items-end gap-2
          px-3 py-2.5 rounded-2xl
          border border-black/15 bg-white/30
        "
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="
            max-h-32 min-h-[42px] resize-none
            bg-transparent text-[14px] leading-6 text-[#25231F]
            outline-none placeholder:text-[#C5BAAA]
          "
          style={{ fontFamily: "inherit" }}
        />

        <button
          type="button"
          disabled={disabled || !text.trim()}
          onClick={submit}
          className="
            rounded-2xl px-5 py-3 text-[14px] font-semibold
            bg-[#A94737] text-[#FFFAF4]
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:bg-[#8f3a2c] transition-colors
          "
        >
          写作
        </button>
      </div>

      <p className="text-[11px] text-[#C5BAAA] text-center mt-2">
        Enter 发送 · Ctrl+Enter 换行
      </p>
    </footer>
  );
}
