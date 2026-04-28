// ============================================================
// MobileDrawer.tsx — 移动端左侧抽屉
// Standup Workspace v3.0
// ============================================================

import React, { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileDrawer({ open, onClose, children }: Props) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`
          fixed z-30 inset-y-0 left-0 w-[min(82vw,320px)]
          flex flex-col
          bg-[#FBF8F0]
          border-r border-black/10
          transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          boxShadow: open ? "18px 0 50px rgba(65,52,36,0.16)" : undefined,
        }}
        aria-hidden={!open}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/10">
          <span className="text-[13px] text-[#8A8174]">作品列表</span>
          <button
            onClick={onClose}
            className="
              w-8 h-8 rounded-full
              border border-black/10
              flex items-center justify-center
              text-[#8A8174] text-lg
              hover:bg-black/5 transition-colors
            "
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </aside>
    </>
  );
}
