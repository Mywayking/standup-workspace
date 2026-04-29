/**
 * useWorkflowSession unit tests.
 * Tests the pure query/chain functions that don't require React hooks context.
 */

import { buildSourcePath } from "../../app/write/washi/types";

describe("buildSourcePath", () => {
  test("no parent → starts with 用户输入", () => {
    const result = buildSourcePath(undefined, "premise");
    expect(result).toEqual(["用户输入", "premise"]);
  });

  test("null parent → starts with 用户输入", () => {
    const result = buildSourcePath(null, "premise");
    expect(result).toEqual(["用户输入", "premise"]);
  });

  test("material card → appends premise", () => {
    const result = buildSourcePath({ sourcePath: ["用户输入"] }, "premise");
    expect(result).toEqual(["用户输入", "premise"]);
  });

  test("premise card → appends angle", () => {
    const result = buildSourcePath(
      { sourcePath: ["用户输入", "premise"] },
      "angle"
    );
    expect(result).toEqual(["用户输入", "premise", "angle"]);
  });

  test("angle card → appends rewrite", () => {
    const result = buildSourcePath(
      { sourcePath: ["用户输入", "premise", "angle"] },
      "rewrite"
    );
    expect(result).toEqual(["用户输入", "premise", "angle", "rewrite"]);
  });

  test("rewrite card → appends rewrite (iteration allowed)", () => {
    const result = buildSourcePath(
      { sourcePath: ["用户输入", "premise", "angle", "rewrite"] },
      "rewrite"
    );
    expect(result).toEqual([
      "用户输入",
      "premise",
      "angle",
      "rewrite",
      "rewrite",
    ]);
  });

  test("deep chain preserves full path", () => {
    const result = buildSourcePath(
      {
        sourcePath: [
          "用户输入",
          "premise",
          "premise",
          "angle",
          "rewrite",
          "rewrite",
        ],
      },
      "rewrite"
    );
    expect(result).toEqual([
      "用户输入",
      "premise",
      "premise",
      "angle",
      "rewrite",
      "rewrite",
      "rewrite",
    ]);
  });

  test("parent with only type (no sourcePath) → starts from type", () => {
    const result = buildSourcePath({ type: "premise" }, "angle");
    expect(result).toEqual(["premise", "angle"]);
  });
});
