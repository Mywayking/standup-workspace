"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import GuidedWriteClient from "./GuidedWriteClient";
import QuickToolsClient from "./QuickToolsClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { ToastProvider } from "@/components/Toast";

// Washi UI is the new default — set NEXT_PUBLIC_USE_WASHI_WRITE="false" to revert
const USE_WASHI = process.env.NEXT_PUBLIC_USE_WASHI_WRITE !== "false";

// Dynamic import: SSR-safe (no localStorage access during SSR)
const WashiWriteClient = dynamic(
  () => import("./washi/WashiWriteClient").then((m) => m.WashiWriteClient),
  { ssr: false }
);

export default function WritePageContent() {
  const [mode, setMode] = useState<"guided" | "quick">("guided");

  return (
    <ErrorBoundary>
      <WorkflowProvider>
        <ToastProvider>
          {USE_WASHI ? (
            <WashiWriteClient />
          ) : mode === "guided" ? (
            <GuidedWriteClient onSwitchToQuick={() => setMode("quick")} />
          ) : (
            <QuickToolsClient />
          )}
        </ToastProvider>
      </WorkflowProvider>
    </ErrorBoundary>
  );
}
