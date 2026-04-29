// ============================================================
// ResponsiveWashiShell.tsx — 响应式三栏外壳
// Standup Workspace v3.0
// ============================================================

import React from "react";
import { WorkSidebar } from "./WorkSidebar";
import { WashiRightPanel } from "../WashiRightPanel";

interface Props {
  /** Left sidebar content (session list) */
  sidebar: React.ReactNode;
  /** Right outline panel content */
  outline: React.ReactNode;
  /** Main content area */
  main: React.ReactNode;
}

export function ResponsiveWashiShell({ sidebar, outline, main }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F5EFE3]">
      {/* Left: sidebar — hidden on mobile, shown on md+ */}
      <aside className="hidden md:flex w-[260px] flex-shrink-0 border-r border-black/8 overflow-hidden">
        {sidebar}
      </aside>

      {/* Center: main content — always shown */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {main}
      </main>

      {/* Right: outline — hidden on mobile/tablet, shown on lg+ */}
      <aside className="hidden lg:flex w-[300px] flex-shrink-0 border-l border-black/8 overflow-hidden">
        {outline}
      </aside>
    </div>
  );
}
