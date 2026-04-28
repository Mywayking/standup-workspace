// ============================================================
// ResponsiveWashiShell.tsx — 响应式三栏外壳
// Standup Workspace v3.0
// ============================================================

import React from "react";

interface Props {
  sidebar: React.ReactNode;
  outline: React.ReactNode;
  main: React.ReactNode;
}

export function ResponsiveWashiShell({ sidebar, outline, main }: Props) {
  return (
    <div
      className="min-h-[100svh] bg-[#F5EFE3] text-[#25231F] md:h-[100dvh] md:overflow-hidden"
      // Dot-grid texture via pseudo-element in globals.css
    >
      <div
        className="
          grid min-h-[100svh] grid-cols-1
          md:h-[100dvh] md:grid-cols-[248px_minmax(0,1fr)]
          xl:grid-cols-[248px_minmax(0,1fr)_288px]
          gap-0 md:gap-3
          p-0 md:p-4
        "
      >
        {/* Left: sidebar — hidden on mobile, shown on md+, xl always */}
        <aside
          className="
            hidden min-h-0 overflow-hidden rounded-none md:rounded-[24px]
            border-0 md:border md:border-black/10
            bg-[#FBF8F0]/85 md:bg-[#FBF8F0]
            flex flex-col
          "
        >
          {sidebar}
        </aside>

        {/* Center: main content — always shown */}
        <main
          className="
            min-h-0 min-w-0 overflow-hidden
            bg-[#FBF8F0]/92 md:rounded-[24px]
            border-0 md:border md:border-black/10
            flex flex-col
          "
          style={{ height: "100svh", maxHeight: "100dvh" }}
        >
          {main}
        </main>

        {/* Right: outline — hidden on mobile/tablet, shown on xl+ */}
        <aside
          className="
            hidden min-h-0 overflow-hidden rounded-none xl:rounded-[24px]
            border-0 xl:border xl:border-black/10
            bg-[#FBF8F0]/85
            flex flex-col
          "
        >
          {outline}
        </aside>
      </div>
    </div>
  );
}
