"use client";
import React from "react";
import StickyPrimaryAction from "./StickyPrimaryAction";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  actionState: "idle" | "pending" | "success" | "error";
  actionLabel: string;
  actionMessage?: string;
  placeholder?: string;
  showTypeChips?: boolean;
  selectedType?: string;
  onSelectType?: (key: string) => void;
}

const TYPE_CHIPS = [
  { key: "素材", label: "📝 素材", desc: "生活观察" },
  { key: "梗",   label: "🔥 梗",   desc: "笑点吐槽" },
  { key: "前提", label: "💡 前提", desc: "已有判断" },
  { key: "草稿", label: "✍️ 草稿", desc: "完整段子" },
];

export default function MobileBottomInput({
  value, onChange, onSubmit,
  actionState, actionLabel, actionMessage,
  placeholder = "写点素材、前提或草稿…",
  showTypeChips = false,
  selectedType, onSelectType,
}: Props) {
  return (
    <div className="sticky bottom-[60px] lg:bottom-0 bg-white border-t px-4 py-3 z-20">
      {/* Type chips - scrollable */}
      {showTypeChips && (
        <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide pb-1">
          {TYPE_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => onSelectType?.(chip.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedType === chip.key
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none transition-colors bg-gray-50"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && value.trim()) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />

      {/* Action button */}
      <div className="mt-2">
        <StickyPrimaryAction
          label={actionLabel}
          status={actionState}
          statusMessage={actionMessage}
          onClick={onSubmit}
          disabled={!value.trim() && actionState !== "pending"}
        />
      </div>
    </div>
  );
}