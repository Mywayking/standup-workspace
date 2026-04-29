// Use actual source with path alias support via ts-jest
// Card mappers are pure functions so we can test them without mocking streaming

import { mapResultToCard } from "../../app/write/washi/lib/cardMappers";

const makeIntent = (type: string) =>
  ({
    type,
    endpoint: `/api/write/${type}/stream`,
    confidence: 0.8,
    reason: "test",
  }) as any;

describe("cardMappers", () => {
  describe("rewrite", () => {
    test("shows 修改理由 and 新增技巧 from suggestions", () => {
      const result = {
        improved_script: "这是改稿版本的段子内容",
        suggestions: [
          { text: "第一个优化点", reason: "节奏更好", technique_added: "节奏控制" },
          "第二个优化点",
        ],
      };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("rewrite"),
        result,
        tokens: JSON.stringify(result),
      });
      expect(card.content).toContain("━━ 改稿版本 ━━");
      expect(card.content).toContain("这是改稿版本的段子内容");
      expect(card.content).toContain("━━ 修改理由 ━━");
      expect(card.content).toContain("节奏更好");
      expect(card.content).toContain("━━ 新增技巧 ━━");
      expect(card.content).toContain("节奏控制");
      // String-only suggestion "第二个优化点" has no reason/technique so goes to 优化点 (empty here)
    });

    test("shows improved_script in 改稿版本 section", () => {
      const result = { improved_script: "新段子" };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("rewrite"),
        result,
        tokens: JSON.stringify(result),
      });
      expect(card.content).toContain("━━ 改稿版本 ━━");
      expect(card.content).toContain("新段子");
    });

    test("shows 优化点 from evaluation map", () => {
      const result = {
        improved_script: "新段子",
        evaluation: {
          "节奏": "优化了节奏，铺垫更充分",
          "笑点": "笑点更密集",
        },
      };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("rewrite"),
        result,
        tokens: JSON.stringify(result),
      });
      expect(card.content).toContain("━━ 优化点 ━━");
      expect(card.content).toContain("节奏");
      expect(card.content).toContain("笑点");
    });

    test("falls back to tokens if improved_script is empty", () => {
      const result = {};
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("rewrite"),
        result,
        tokens: "fallback content",
      });
      expect(card.content).toContain("fallback content");
    });
  });

  describe("premise", () => {
    test("extracts theme and recommendation", () => {
      const result = {
        theme: "职场沟通",
        attitude: "讽刺",
        recommendation: { text: "推荐前提", reason: "容易展开" },
      };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("premise"),
        result,
        tokens: JSON.stringify(result),
      });
      expect(card.content).toContain("━━ 前提 ━━");
      expect(card.content).toContain("职场沟通");
      expect(card.content).toContain("讽刺");
      expect(card.content).toContain("推荐前提");
    });

    test("shows premise candidates", () => {
      const result = {
        theme: "职场",
        premise_candidates: [
          "候选人A：开场铺垫",
          "候选人B：直接冲突",
        ],
      };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("premise"),
        result,
        tokens: JSON.stringify(result),
      });
      expect(card.content).toContain("候选人A");
      expect(card.content).toContain("候选人B");
    });
  });

  describe("angles", () => {
    test("formats angles with name and description", () => {
      const result = {
        angles: [
          {
            title: "职场身份错位",
            premise: "员工和公司对'主人翁'理解不同",
            expansion_idea: "用具体例子展现期望落差",
          },
        ],
      };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("angles"),
        result,
        tokens: JSON.stringify(result),
      });
      expect(card.content).toContain("1. 职场身份错位");
      expect(card.content).toContain("用具体例子展现期望落差");
    });

    test("handles string angles", () => {
      const result = { angles: ["角度一", "角度二"] };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("angles"),
        result,
        tokens: JSON.stringify(result),
      });
      expect(card.content).toContain("1. 角度一");
      expect(card.content).toContain("2. 角度二");
    });
  });

  describe("joke_to_premise", () => {
    test("priority: recTitle > firstPremise > core_topic", () => {
      const result = {
        core_topic: "职场双标",
        recommendation: { title: "推荐前提标题", reason: "容易展开" },
        premises: [{ title: "前提1" }],
      };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("joke_to_premise"),
        result,
        tokens: JSON.stringify(result),
      });
      // Top priority is rec.title
      expect(card.content).toContain("推荐前提标题");
    });

    test("falls back to firstPremise when no recommendation.title", () => {
      const result = {
        core_topic: "职场双标",
        recommendation: { text: "推荐前提文本" },
        premises: [{ title: "前提1", opening_line: "开场白1" }],
      };
      const card = mapResultToCard({
        sessionId: "test-session",
        intent: makeIntent("joke_to_premise"),
        result,
        tokens: JSON.stringify(result),
      });
      // recTitle first (rec.title not rec.text), then premises[0].title
      expect(card.content).toMatch(/推荐前提文本|前提1/);
    });
  });
});