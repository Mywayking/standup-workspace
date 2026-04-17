"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  onClearHistory?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, errorInfo);
  }

  handleClearAndReload = () => {
    try {
      localStorage.removeItem("comedy_history");
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4 p-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-md text-center">
            <p className="text-red-500 font-semibold text-lg mb-2">⚠️ 页面出错</p>
            <p className="text-sm text-gray-500 mb-2">
              {this.state.error?.message || "未知错误"}
            </p>
            {this.state.error?.stack && (
              <p className="text-xs text-gray-400 mb-4 text-left font-mono truncate">
                {this.state.error.stack.split("\n")[0]}
              </p>
            )}
            <button
              onClick={this.handleClearAndReload}
              className="px-5 py-2.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-sm font-medium transition-colors"
            >
              清除历史记录并重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
