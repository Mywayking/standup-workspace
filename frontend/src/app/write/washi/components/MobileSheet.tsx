// ============================================================
// MobileSheet.tsx — 移动端底部面板
// Standup Workspace v3.0
// ============================================================

import React, { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileSheet({ open, onClose, children }: Props) {
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

      {/* Sheet */}
      <aside
        className={`
          fixed z-31 left-0 right-0 bottom-0
          max-h-[min(76svh,620px)]
          flex flex-col
          bg-[#FBF8F0]
          rounded-t-3xl border-t border-black/10
          transition-transform duration-200 ease-out
          ${open ? "translate-y-0" : "translate-y-full"}
        `}
        style={{
          boxShadow: open ? "0 -18px 50px rgba(65,52,36,0.16)" : undefined,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-hidden={!open}
      >
        {/* Sheet handle */}
        <div className="flex items-center justify-center pt-3 pb-2 px-4 border-b border-black/8">
          <div className="w-9 h-1 rounded-full bg-black/15" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
          <span className="text-[13px] text-[#8A8174]">作品脉络</span>
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
