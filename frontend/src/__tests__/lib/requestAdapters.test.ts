import { buildRequestBody } from "../../app/write/washi/lib/requestAdapters";

const makeIntent = (type: string) => ({
  type: type as any,
  endpoint: `/api/write/${type}/stream`,
  confidence: 0.8,
  reason: "test",
}) as any;

describe("buildRequestBody", () => {
  test("premise sends text and material", () => {
    const body = buildRequestBody(makeIntent("premise"), "素材内容");
    expect(body.text).toBe("素材内容");
    expect(body.material).toBe("素材内容");
  });

  test("joke_to_premise sends text and joke", () => {
    const body = buildRequestBody(makeIntent("joke_to_premise"), "这是一个梗");
    expect(body.text).toBe("这是一个梗");
    expect(body.joke).toBe("这是一个梗");
  });

  test("angles sends premise and text", () => {
    const body = buildRequestBody(makeIntent("angles"), "前提内容");
    expect(body.premise).toBe("前提内容");
    expect(body.text).toBe("前提内容");
    expect(body.count).toBe("5");
  });

  test("rewrite sends text and draft", () => {
    const body = buildRequestBody(makeIntent("rewrite"), "段子内容");
    expect(body.text).toBe("段子内容");
    expect(body.draft).toBe("段子内容");
    expect(body.mode).toBe("quick");
  });

  test("feedback sends laugh_parts, flop_parts, forgot_parts", () => {
    const body = buildRequestBody(makeIntent("feedback"), "段子内容", {
      laughParts: "笑点1",
      flopParts: "垮点1",
      forgotParts: "忘记1",
    });
    expect(body.laugh_parts).toBe("笑点1");
    expect(body.flop_parts).toBe("垮点1");
    expect(body.forgot_parts).toBe("忘记1");
    expect(body.original_script).toBe("段子内容");
  });

  test("premise default sends only text (no material field)", () => {
    const body = buildRequestBody(makeIntent("unknown"), "fallback素材");
    expect(body.text).toBe("fallback素材");
    // default case only sends text, not material
    expect(Object.keys(body)).toContain("text");
  });
});