"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** 默认 Tab：register | login */
  defaultTab?: "register" | "login";
}

export default function LoginModal({ open, onClose, defaultTab = "register" }: LoginModalProps) {
  const [tab, setTab] = useState<"register" | "login">(defaultTab);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  // 切换 Tab 时清空表单
  useEffect(() => {
    if (open) {
      setIdentifier("");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setTab(defaultTab);
    }
  }, [open, defaultTab]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isEmail = identifier.includes("@");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim()) {
      setError("请输入邮箱或手机号");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    if (tab === "register") {
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
      if (password.length < 8) {
        setError("密码至少 8 位");
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === "login") {
        await login(identifier.trim(), password);
      } else {
        await register(
          identifier.trim(),
          isEmail ? "email" : "phone",
          password,
          confirmPassword
        );
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {tab === "register" ? "注册" : "登录"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "register"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => { setTab("register"); setError(""); }}
          >
            注册
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "login"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => { setTab("login"); setError(""); }}
          >
            登录
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 标识符 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tab === "register" ? "邮箱 / 手机号" : "邮箱 / 手机号"}
            </label>
            <input
              type={isEmail ? "email" : "tel"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={tab === "register" ? "邮箱或手机号" : "邮箱或手机号"}
              className={inputClass}
              autoFocus
            />
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              className={inputClass}
            />
          </div>

          {/* 确认密码（仅注册） */}
          {tab === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className={inputClass}
              />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "处理中..." : tab === "register" ? "注册" : "登录"}
          </button>

          {/* 忘记密码（仅登录） */}
          {tab === "login" && (
            <div className="text-center">
              <a
                href="/forgot-password"
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                忘记密码？
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
