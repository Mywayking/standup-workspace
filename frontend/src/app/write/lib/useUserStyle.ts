/**
 * useUserStyle.ts — User Style Profile hook
 * Standup Workspace v3.0 Phase 9
 * Uses localStorage for persistence (no cloud sync yet)
 */

import { useState, useEffect, useCallback } from "react";
import type { UserStyleProfile } from "../types";

const STYLE_KEY = "standup_v3_user_style";

function loadStyle(): UserStyleProfile {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { userId: "local", commonTopics: [], forbiddenTopics: [], preferredTechniques: [] };
}

function saveStyle(profile: UserStyleProfile) {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(profile));
  } catch {}
}

export function useUserStyle() {
  const [profile, setProfile] = useState<UserStyleProfile>(loadStyle);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile(loadStyle());
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserStyleProfile>) => {
    const updated: UserStyleProfile = {
      ...profile,
      ...updates,
      userId: profile.userId || "local",
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    saveStyle(updated);

    // Also try backend (non-blocking)
    setSaving(true);
    try {
      await fetch("/api/write/style-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {
      // Backend is optional; localStorage is primary
    }
    setSaving(false);
  }, [profile]);

  const clearProfile = useCallback(() => {
    const empty: UserStyleProfile = { userId: "local", commonTopics: [], forbiddenTopics: [], preferredTechniques: [] };
    setProfile(empty);
    saveStyle(empty);
  }, []);

  return { profile, updateProfile, clearProfile, saving };
}
