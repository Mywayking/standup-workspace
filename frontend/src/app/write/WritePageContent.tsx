"use client";

import { useState } from "react";
import GuidedWriteClient from "./GuidedWriteClient";
import QuickToolsClient from "./QuickToolsClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { ToastProvider } from "@/components/Toast";

// Washi UI is the new default — set NEXT_PUBLIC_USE_WASHI_WRITE="false" to revert
const USE_WASHI = process.env.NEXT_PUBLIC_USE_WASHI_WRITE !== "false";

export default function WritePageContent() {
  const [mode, setMode] = useState<"guided" | "quick">("guided");

  return (
    <ErrorBoundary>
      <WorkflowProvider>
        <ToastProvider>
          {USE_WASHI ? (
            // Dynamic import to avoid SSR issues with localStorage
            <WashiWriteClientWrapper />
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

// Separate component so we can use dynamic import
function WashiWriteClientWrapper() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WashiWriteClient } = require("./washi/WashiWriteClient");
  return <WashiWriteClient />;
}
