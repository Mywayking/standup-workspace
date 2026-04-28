"use client";

import React from "react";

export type Tab = "create" | "library" | "mine";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "create",  icon: "✍️", label: "创作" },
  { key: "library", icon: "📚", label: "段子库" },
  { key: "mine",    icon: "👤", label: "我的" },
];

export default function MobileBottomNav({ active, onChange }: Props) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-area-bottom">
      <div className="flex">
        {TABS.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors ${
              active === key
                ? "text-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
