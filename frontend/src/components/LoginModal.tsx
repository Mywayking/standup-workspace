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
    "w-full px-3 py-2 border border-black/15 bg-white/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A94737]/30 focus:border-[#A94737] text-[#25231F]";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(37,35,31,0.6)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-[#FBF8F0] rounded-3xl border border-black/10 shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {tab === "register" ? "注册" : "登录"}
            </h2>
            {tab === "register" && (
              <p className="text-sm text-[#A94737] mt-0.5 font-medium">保存这条段子灵感</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Feature list (register only) */}
        {tab === "register" && (
          <div className="px-6 py-3 bg-[#A94737]/8 border-b border-[#A94737]/15">
            <ul className="space-y-1">
              {[
                "保存创作历史",
                "继续上次改稿",
                "建立你的素材库",
                "让 AI 记住你的喜剧风格",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-[#25231F]">
                  <svg className="w-3.5 h-3.5 text-[#A94737] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-black/10">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "register"
                ? "text-[#A94737] border-b-2 border-[#A94737]"
                : "text-[#8A8174] border-b-2 border-transparent hover:text-[#25231F]"
            }`}
            onClick={() => { setTab("register"); setError(""); }}
          >
            注册
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "login"
                ? "text-[#A94737] border-b-2 border-[#A94737]"
                : "text-[#8A8174] border-b-2 border-transparent hover:text-[#25231F]"
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
            <label className="block text-sm font-medium text-[#25231F] mb-1">
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
            <label className="block text-sm font-medium text-[#25231F] mb-1">密码</label>
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
              <label className="block text-sm font-medium text-[#25231F] mb-1">确认密码</label>
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
            <div className="text-sm text-[#A94737] bg-[#A94737]/8 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#A94737] hover:bg-[#8f3a2c] disabled:bg-[#A94737]/40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "处理中..." : tab === "register" ? "登录并保存" : "登录"}
          </button>

          {/* 先复制结果（注册时） */}
          {tab === "register" && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              先复制结果
            </button>
          )}

          {/* 忘记密码（仅登录） */}
          {tab === "login" && (
            <div className="text-center">
              <a
                href="/forgot-password"
                className="text-sm text-[#A94737] hover:text-[#8f3a2c]"
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
