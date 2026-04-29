"use client";

// Washi is the default UI for /write
// It reads/writes localStorage, so it must only render client-side

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

// Check if WASHi should be disabled via URL param (for debugging)
function useWashiFlag() {
  const [useWashi, setUseWashi] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("legacy") === "1") {
      setUseWashi(false);
    }
  }, []);
  return useWashi;
}

// Dynamically load Washi to avoid SSR/localStorage issues
const WashiWriteClient = dynamic(
  () => import("./washi/WashiWriteClient").then((m) => m.WashiWriteClient),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "#F5EFE3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "STSong, Songti SC, serif",
          color: "#25231F",
          fontSize: "14px",
          letterSpacing: "0.08em",
        }}
      >
        <span>正在打开喜剧写稿台…</span>
      </div>
    ),
  }
);

// GuidedWriteClient kept as fallback — will be removed once Washi is stable
import GuidedWriteClient from "./GuidedWriteClient";
import QuickToolsClient from "./QuickToolsClient";

export default function WritePageContent() {
  const [mode, setMode] = useState<"guided" | "quick">("guided");
  const useWashi = useWashiFlag();

  return (
    <ErrorBoundary>
      <ToastProvider>
        {useWashi ? (
          <WashiWriteClient />
        ) : mode === "guided" ? (
          <GuidedWriteClient onSwitchToQuick={() => setMode("quick")} />
        ) : (
          <QuickToolsClient />
        )}
      </ToastProvider>
    </ErrorBoundary>
  );
}
