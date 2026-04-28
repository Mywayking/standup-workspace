"use client";

// QuickToolsClient wraps the existing WriteTabs as the "专业工具" mode.
// It keeps the original WriteTabs functionality completely intact.
import WriteTabs from "./WriteTabs";

export default function QuickToolsClient() {
  return <WriteTabs />;
}
