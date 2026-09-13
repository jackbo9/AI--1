import { describe, expect, it } from "vitest";
import { briefFromConfirmedDescription, compileIllustrationBrief } from "@/providers/prompt-compiler";
import { seedreamPrompt } from "@/providers/illustration-provider";
import { finalistGroupSchema } from "@/contracts/poster";

describe("people choices reach the final provider request", () => {
  for (const peopleMode of ["auto", "allow", "forbid"] as const) {
    it(peopleMode, async () => {
      const input = { category: "competition" as const, themeKeywords: [], visualIntent: "羽毛球击球瞬间，运动摄影", peopleMode };
      const prompt = seedreamPrompt(briefFromConfirmedDescription(input.visualIntent, input));
      const fallback = await compileIllustrationBrief(input);
      if (peopleMode === "forbid") {
        expect(prompt).toContain("禁止人物、人体、手脚");
        expect(fallback.brief.systemDirection).toContain("禁止人物、人体、手脚");
      } else {
        expect(prompt).not.toMatch(/默认不生成人物|默认不出现人物|禁止人物、人体/);
        expect(fallback.brief.style).not.toMatch(/默认不出现人物/);
        expect(prompt).toContain(peopleMode === "allow" ? "画面包含运动员局部参与动作" : "根据动作需要");
      }
      expect(prompt).toContain("Logo");
      expect(prompt).toContain("二维码");
    });
  }
  it("accepts legacy labels and new two-to-four-character labels only", () => {
    for (const label of ["男单", "混合双人", "公开组", "青年组"]) expect(finalistGroupSchema.safeParse({ label, entrants: [] }).success).toBe(true);
    for (const label of ["", "组", "一二三四五"]) expect(finalistGroupSchema.safeParse({ label, entrants: [] }).success).toBe(false);
  });
});
