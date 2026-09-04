import { describe, expect, it } from "vitest";
import {
  normalizeLines,
  splitDraftLines
} from "@/components/multiline-fields";

describe("multiline list fields", () => {
  it("preserves the trailing empty line while the user is typing", () => {
    expect(splitDraftLines("第一点\n")).toEqual(["第一点", ""]);
    expect(splitDraftLines("第一点\n第二点")).toEqual(["第一点", "第二点"]);
  });

  it("removes blank lines only when content is submitted", () => {
    expect(normalizeLines([" 第一点 ", "", "第二点"])).toEqual([
      "第一点",
      "第二点"
    ]);
    expect(normalizeLines(splitDraftLines(""))).toEqual([]);
  });
});
