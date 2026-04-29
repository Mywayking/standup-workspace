/**
 * workflow-mobile-layout.spec.ts
 *
 * E2E validation for Epic 4.1 — 移动端单列布局
 *
 * Validates:
 * - Mobile (< md): hamburger + outline sheet buttons visible, drawer/sheet open+close
 * - Desktop (lg+): three-column layout visible, mobile controls hidden
 *
 * Run against LIVE:
 *   E2E_BASE_URL=https://standup.alwayshaha.art npx playwright test tests/e2e/workflow-mobile-layout.spec.ts
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://standup.alwayshaha.art";

// ─── Mobile viewport ───────────────────────────────────────

test("mobile: hamburger opens drawer, outline button opens sheet", async ({ page }) => {
  // Force mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto(`${BASE}/write`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  // App must load
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  // ── Hamburger button should be visible on mobile ────────
  const hamburger = page.getByLabel("打开作品列表");
  await expect(hamburger).toBeVisible();

  // ── Outline button should be visible on mobile ──────────
  const outlineBtn = page.getByLabel("打开作品脉络");
  await expect(outlineBtn).toBeVisible();

  // ── ResponsiveWashiShell sidebar should be hidden on mobile ─
  // hidden md:flex → hidden on mobile
  const shellSidebar = page.locator("main + aside");
  await expect(shellSidebar).not.toBeVisible();

  // ── Open drawer via hamburger ────────────────────────────
  await hamburger.click();

  // Drawer opens: MobileDrawer removes -translate-x-full
  // Wait for drawer to be fully open (has aria-hidden=false)
  const drawer = page.locator('aside[aria-hidden="false"]').filter({ hasText: "作品列表" });
  await expect(drawer).toBeVisible({ timeout: 5000 });

  // Close drawer by pressing Escape
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible({ timeout: 5000 });

  // ── Open outline sheet via outline button ───────────────
  await outlineBtn.click();

  // Sheet opens: MobileSheet removes translate-y-full
  const sheet = page.locator('aside[aria-hidden="false"]').filter({ hasText: "作品脉络" });
  await expect(sheet).toBeVisible({ timeout: 5000 });

  // Close sheet by pressing Escape
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible({ timeout: 5000 });
});

// ─── Desktop viewport ──────────────────────────────────────

test("desktop lg+: three-column layout, mobile controls hidden", async ({ page }) => {
  // Force desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${BASE}/write`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  // ── Hamburger + outline button should be hidden on desktop ─
  await expect(page.getByLabel("打开作品列表")).not.toBeVisible();
  await expect(page.getByLabel("打开作品脉络")).not.toBeVisible();

  // ── Desktop shell: main + sidebar + outline ──────────────────
  // ResponsiveWashiShell renders: <aside> + <main> + <aside>
  // main + aside = the outline panel (adjacent sibling after main)
  const outlinePanel = page.locator("main + aside");
  await expect(outlinePanel).toBeVisible({ timeout: 5000 });

  // Sidebar (first aside before main) should also be visible at lg+
  const sidebar = page.locator("aside").first();
  await expect(sidebar).toBeVisible();
});

// ── Note ──────────────────────────────────────────────────
// Desktop session creation is covered by workflow-source-path.spec.ts.
// This file focuses on layout validation only.
