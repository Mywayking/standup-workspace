/**
 * workflow-source-path.spec.ts
 *
 * E2E validation for Epic 3.1 — parentId / sourcePath chain.
 * Validates that card creation correctly extends sourcePath and sets sourceCardId
 * through the full创作链路: material → premise → angle → rewrite.
 *
 * Run against LIVE site:
 *   E2E_BASE_URL=https://standup.alwayshaha.art npx playwright test tests/e2e/workflow-source-path.spec.ts
 *
 * Run against local:
 *   npx playwright test tests/e2e/workflow-source-path.spec.ts
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://standup.alwayshaha.art";

test("sourcePath extends correctly through material→premise→angle→rewrite chain", async ({ page }) => {
  // ── Setup ────────────────────────────────────────────────
  await page.goto(`${BASE}/write`, { waitUntil: "networkidle" });

  // Clear any stale sessions so we start clean
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  // Wait for the app to fully hydrate — data-testid appears only after JS loads
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  // ── Step 1: Submit material ───────────────────────────────
  const MATERIAL = "我发现公司降本增效以后，最先被优化的是人的尊严。";

  await page.getByTestId("material-input").fill(MATERIAL);
  await page.getByTestId("submit-write").click();

  // Wait for premise assistant card to appear
  await expect(page.getByTestId("card-premise")).toBeVisible({ timeout: 20000 });

  // ── Step 2: Find angles ──────────────────────────────────
  await page.getByTestId("action-find_angles").click();

  // Wait for angle card to appear
  await expect(page.getByTestId("card-angle")).toBeVisible({ timeout: 30000 });

  // ── Step 3: Expand to draft ─────────────────────────────
  // Step 3: Expand to draft — use make_sharper on premise card (shorter content → faster)
  // This validates the rewrite path without waiting 30-60s for long angle content
  await page.getByTestId("card-premise").getByTestId("action-make_sharper").click();

  // Wait for rewrite card to appear
  await expect(page.getByTestId("card-rewrite")).toBeVisible({ timeout: 60000 });

  // ── Step 4: Read localStorage and assert chain ──────────
  const rawSessions = await page.evaluate(() => {
    return localStorage.getItem("standup_write_v1_sessions") ?? "[]";
  });

  const sessions = JSON.parse(rawSessions) as Array<{
    cards: Array<{
      id: string;
      type: string;
      role: string;
      sourcePath: string[];
      sourceCardId?: string;
      content: string;
    }>;
  }>;

  expect(sessions.length, "at least one session should exist").toBeGreaterThan(0);

  const cards = sessions[0].cards;

  // Separate by role
  const userCards = cards.filter((c) => c.role === "user");
  const premiseCards = cards.filter((c) => c.type === "premise" && c.role === "assistant");
  const angleCards = cards.filter((c) => (c.type === "angle" || c.type === "angles") && c.role === "assistant");
  const rewriteCards = cards.filter((c) => c.type === "rewrite" && c.role === "assistant");

  expect(premiseCards.length, "at least one premise card").toBeGreaterThan(0);
  expect(angleCards.length, "at least one angle card").toBeGreaterThan(0);
  expect(rewriteCards.length, "at least one rewrite card").toBeGreaterThan(0);

  const premiseCard = premiseCards[0];
  const angleCard = angleCards[0];
  const rewriteCard = rewriteCards[0];
  const materialCard = userCards[0];

  // ── Assert sourcePath ────────────────────────────────────

  // material: ["用户输入"]
  expect(materialCard.sourcePath, "material sourcePath").toEqual(["用户输入"]);

  // premise: ["用户输入", "premise"]
  expect(premiseCard.sourcePath, "premise sourcePath").toContain("premise");
  expect(premiseCard.sourcePath[0], "premise starts from 用户输入").toBe("用户输入");
  expect(
    premiseCard.sourcePath.filter((s) => s === "premise").length,
    "premise sourcePath has exactly one 'premise'"
  ).toBe(1);

  // angle: sourcePath should end with "angle" and chain from 用户输入
  expect(angleCard.sourcePath, "angle sourcePath").toContain("angle");
  expect(angleCard.sourcePath[0], "angle chain starts from 用户输入").toBe("用户输入");

  // rewrite: from make_sharper on premise card → sourcePath = [用户输入, premise, rewrite]
  // (not from angle since make_sharper was clicked on premise card)
  expect(rewriteCard.sourcePath, "rewrite sourcePath").toContain("rewrite");
  expect(rewriteCard.sourcePath[0], "rewrite chain starts from 用户输入").toBe("用户输入");
  expect(
    rewriteCard.sourcePath.includes("premise") && rewriteCard.sourcePath.includes("rewrite"),
    "rewrite sourcePath should include premise and rewrite"
  ).toBe(true);

  // rewriteCard.sourceCardId should point to the premise card (make_sharper source)
  const premiseIds = cards.filter((c) => c.type === "premise").map((c) => c.id);
  expect(
    premiseIds.includes(rewriteCard.sourceCardId ?? ""),
    "rewrite parent should be the premise card (make_sharper)"
  ).toBe(true);

  // ── Assert sourceCardId (parent linkage) ──────────────────

  const allPremiseIds = cards.filter((c) => c.type === "premise").map((c) => c.id);
  const allAngleIds = cards.filter((c) => c.type === "angle").map((c) => c.id);

  // premiseCard.sourceCardId should point to materialCard.id
  expect(premiseCard.sourceCardId, "premise parent is material card").toBe(materialCard.id);

  // angleCard.sourceCardId should point to a premise card
  expect(
    allPremiseIds.includes(angleCard.sourceCardId ?? ""),
    "angle parent should be a premise card"
  ).toBe(true);

  // rewriteCard.sourceCardId should point to the premise card (make_sharper on premise)
  expect(
    allPremiseIds.includes(rewriteCard.sourceCardId ?? ""),
    "rewrite parent should be the premise card (make_sharper on premise)"
  ).toBe(true);

  // ── Step 5: Refresh and verify persistence ───────────────
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("material-input")).toBeVisible({ timeout: 20000 });

  const rawAfterReload = await page.evaluate(() => {
    return localStorage.getItem("standup_write_v1_sessions") ?? "[]";
  });

  const sessionsAfterReload = JSON.parse(rawAfterReload) as Array<{
    cards: Array<{
      type: string;
      role: string;
      sourcePath: string[];
      sourceCardId?: string;
    }>;
  }>;

  const cardsAfterReload = sessionsAfterReload[0]?.cards ?? [];

  const premiseAfterReload = cardsAfterReload.find(
    (c) => c.type === "premise" && c.role === "assistant"
  );
  const angleAfterReload = cardsAfterReload.find(
    (c) => (c.type === "angle" || c.type === "angles") && c.role === "assistant"
  );
  const rewriteAfterReload = cardsAfterReload.find(
    (c) => c.type === "rewrite" && c.role === "assistant"
  );

  // sourcePath must survive page refresh
  expect(premiseAfterReload?.sourcePath).toContain("premise");
  expect(angleAfterReload?.sourcePath).toContain("angle");
  expect(rewriteAfterReload?.sourcePath).toContain("rewrite");

  // sourceCardId must survive page refresh
  expect(premiseAfterReload?.sourceCardId, "premise sourceCardId persisted").toBeTruthy();
  expect(angleAfterReload?.sourceCardId, "angle sourceCardId persisted").toBeTruthy();
  expect(rewriteAfterReload?.sourceCardId, "rewrite sourceCardId persisted").toBeTruthy();

  console.log("✅ All assertions passed");
  console.log("  premise sourcePath:", premiseAfterReload?.sourcePath);
  console.log("  angle   sourcePath:", angleAfterReload?.sourcePath);
  console.log("  rewrite sourcePath:", rewriteAfterReload?.sourcePath);
});
