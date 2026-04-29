import { detectWriteIntent } from "../../app/write/washi/hooks/useWriteIntent";

describe("detectWriteIntent", () => {
  test("short material defaults to premise", () => {
    const result = detectWriteIntent("老板说要有主人翁意识，但裁员时说我是外包");
    expect(result.type).toBe("premise");
  });

  test('"找角度" triggers angles', () => {
    const result = detectWriteIntent("这个素材找角度");
    expect(result.type).toBe("angles");
  });

  test('"换个角度" triggers angles', () => {
    const result = detectWriteIntent("换个角度写这个");
    expect(result.type).toBe("angles");
  });

  test('"发散" triggers angles', () => {
    const result = detectWriteIntent("帮我发散一下这个素材");
    expect(result.type).toBe("angles");
  });

  test('"改稿" triggers rewrite', () => {
    const result = detectWriteIntent("帮我改稿");
    expect(result.type).toBe("rewrite");
  });

  test('"润色" triggers rewrite', () => {
    const result = detectWriteIntent("帮我润色一下");
    expect(result.type).toBe("rewrite");
  });

  test('"优化" triggers rewrite', () => {
    const result = detectWriteIntent("优化这段");
    expect(result.type).toBe("rewrite");
  });

  test('"反推前提" triggers joke_to_premise', () => {
    const result = detectWriteIntent("这个梗反推前提");
    expect(result.type).toBe("joke_to_premise");
  });

  test('"梗写前提" triggers joke_to_premise', () => {
    const result = detectWriteIntent("帮我梗写前提");
    expect(result.type).toBe("joke_to_premise");
  });

  test("long text (200+) triggers rewrite", () => {
    const long = "a".repeat(200);
    const result = detectWriteIntent(long);
    expect(result.type).toBe("rewrite");
  });

  test("empty input returns unknown", () => {
    const result = detectWriteIntent("");
    expect(result.type).toBe("unknown");
  });

  test("short text (3 chars) defaults to premise", () => {
    const result = detectWriteIntent("abc");
    expect(result.type).toBe("premise");
  });

  test("angles takes priority over rewrite keywords", () => {
    const result = detectWriteIntent("找角度，帮我改稿优化一下");
    expect(result.type).toBe("angles");
  });

  test("joke_to_premise takes priority over premise default", () => {
    const result = detectWriteIntent("这句梗反推前提");
    expect(result.type).toBe("joke_to_premise");
  });
});