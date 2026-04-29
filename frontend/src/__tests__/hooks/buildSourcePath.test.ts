import { buildSourcePath } from "../../app/write/washi/types";
import type { WorkCard } from "../../app/write/washi/types";

describe("buildSourcePath", () => {
  test("no parent → starts with 用户输入", () => {
    const result = buildSourcePath(undefined, "premise");
    expect(result).toEqual(["用户输入", "premise"]);
  });

  test("null parent → starts with 用户输入", () => {
    const result = buildSourcePath(null, "premise");
    expect(result).toEqual(["用户输入", "premise"]);
  });

  test("material card parent → appends premise", () => {
    const parent: Pick<WorkCard, "sourcePath"> = {
      sourcePath: ["用户输入"],
    };
    const result = buildSourcePath(parent, "premise");
    expect(result).toEqual(["用户输入", "premise"]);
  });

  test("premise card parent → appends angle", () => {
    const parent: Pick<WorkCard, "sourcePath"> = {
      sourcePath: ["用户输入", "premise"],
    };
    const result = buildSourcePath(parent, "angle");
    expect(result).toEqual(["用户输入", "premise", "angle"]);
  });

  test("angle card parent → appends rewrite", () => {
    const parent: Pick<WorkCard, "sourcePath"> = {
      sourcePath: ["用户输入", "premise", "angle"],
    };
    const result = buildSourcePath(parent, "rewrite");
    expect(result).toEqual(["用户输入", "premise", "angle", "rewrite"]);
  });

  test("rewrite card parent → appends rewrite (iteration allowed)", () => {
    const parent: Pick<WorkCard, "sourcePath"> = {
      sourcePath: ["用户输入", "premise", "angle", "rewrite"],
    };
    const result = buildSourcePath(parent, "rewrite");
    expect(result).toEqual(["用户输入", "premise", "angle", "rewrite", "rewrite"]);
  });

  test("parent with existing path preserves it", () => {
    const parent: Pick<WorkCard, "sourcePath"> = {
      sourcePath: ["用户输入", "premise", "angle", "rewrite", "rewrite"],
    };
    const result = buildSourcePath(parent, "rewrite");
    expect(result).toEqual(["用户输入", "premise", "angle", "rewrite", "rewrite", "rewrite"]);
  });
});
