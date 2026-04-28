"use client";

import { useState } from "react";
import GuidedWriteClient from "./GuidedWriteClient";
import QuickToolsClient from "./QuickToolsClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { ToastProvider } from "@/components/Toast";

export default function WritePageContent() {
  const [mode, setMode] = useState<"guided" | "quick">("guided");

  return (
    <ErrorBoundary>
      <WorkflowProvider>
        <ToastProvider>
          {mode === "guided" ? (
            <GuidedWriteClient onSwitchToQuick={() => setMode("quick")} />
          ) : (
            <QuickToolsClient />
          )}
        </ToastProvider>
      </WorkflowProvider>
    </ErrorBoundary>
  );
}
