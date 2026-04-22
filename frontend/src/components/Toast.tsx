"use client";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 1800);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bg = toast.type === "error" ? "bg-red-50 border-red-200 text-red-700"
    : toast.type === "info" ? "bg-blue-50 border-blue-200 text-blue-700"
    : "bg-white border-gray-200 text-gray-700";

  return (
    <div className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-md text-sm font-medium animate-toast-in ${bg}`}>
      {toast.message}
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
