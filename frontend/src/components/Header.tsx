"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "./LoginModal";

export default function Header() {
  const { user, loggedIn, loading, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginTab, setLoginTab] = useState<"register" | "login">("register");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const openLogin = (tab: "register" | "login" = "register") => {
    setLoginTab(tab);
    setLoginOpen(true);
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <svg className="w-6 h-6 text-[#A94737]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <span className="font-semibold text-gray-900">喜剧分析工作台</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : loggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {user?.profile?.avatarUrl ? (
                    <img
                      src={user.profile.avatarUrl}
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#A94737]/15 flex items-center justify-center text-[#A94737] text-sm font-medium">
                      {user?.profile?.displayName?.[0] || user?.nickname?.[0] || "U"}
                    </div>
                  )}
                  <span className="text-sm text-gray-700 hidden sm:block">
                    {user?.profile?.displayName || user?.nickname}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                      <a
                        href="/settings/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        账号设置
                      </a>
                      <a
                        href="/materials"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        素材库
                      </a>
                      <a
                        href="/jokes"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        段子库
                      </a>
                      <hr className="my-1" />
                      <button
                        onClick={async () => {
                          await logout();
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openLogin("login")}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  登录
                </button>
                <button
                  onClick={() => openLogin("register")}
                  className="text-sm bg-[#A94737] hover:bg-[#8f3a2c] text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  注册
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        defaultTab={loginTab}
      />
    </>
  );
}
