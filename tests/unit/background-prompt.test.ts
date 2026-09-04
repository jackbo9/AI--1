import { describe, expect, it } from "vitest";
import { backgroundNegative, briefFromConfirmedDescription, t01CompositionContract } from "@/providers/prompt-compiler";
import { seedreamPrompt } from "@/providers/illustration-provider";
import { editorialComposition } from "@/providers/visual-direction";

describe("background-only image prompt", () => {
  it("keeps the designer focal range without inheriting the old bottom exclusion", () => {
    expect(editorialComposition).toContain("X=68%–78%、Y=48%–58%");
    expect(editorialComposition).toContain("主体可以向右侧、下方或上下延展");
    expect(editorialComposition).not.toMatch(/68–100|0–28|二维码|Logo|页脚/);
  });
  it("keeps confirmed creative text intact and excludes obsolete field defaults", () => {
    const description = "羽毛球与蓝色球拍拍面接触的瞬间，器材超近景，真实高速摄影，无人物，蓝白主色。";
    const brief = briefFromConfirmedDescription(description, { category: "competition", themeKeywords: [], visualIntent: description, activityName: "羽毛球" });
    const prompt = seedreamPrompt({ ...brief, subject: "企业同事与活动主体", palette: "黑白灰与行政黄" });
    expect(brief.confirmedDescription).toBe(description);
    expect(prompt).toContain("【已确认画面方案】" + description);
    expect(prompt).not.toContain("【画面主体】企业同事");
    expect(prompt).not.toContain("【色彩】黑白灰与行政黄");
    expect(prompt.split(description)).toHaveLength(2);
    expect(prompt.length).toBeLessThanOrEqual(2200);
  });
  it("retains confirmation protection when reverting the optional visual guide", () => {
    const description = "蓝色篮球，球体材质特写，真实摄影，没有人物";
    const brief = briefFromConfirmedDescription(description, { category: "competition", themeKeywords: [], visualIntent: description });
    const prompt = seedreamPrompt({ ...brief, visualStyleMode: "legacy" });
    expect(prompt).toContain(description);
    expect(prompt).not.toContain("【视觉指导】");
    expect(prompt).toContain("【系统强制禁止】");
  });
  it("rejects oversized confirmed text instead of silently dropping its end", () => {
    expect(() => briefFromConfirmedDescription("蓝".repeat(421), { category: "competition", themeKeywords: [], visualIntent: "蓝色" })).toThrow();
  });
  it("keeps QR selection and uploaded assets out of image generation", () => {
    const input = { category: "competition" as const, themeKeywords: ["活力"], visualIntent: "同事在城市街道互动" };
    const withoutQr = seedreamPrompt(briefFromConfirmedDescription(input.visualIntent, { ...input, includeQr: false }));
    const withQr = seedreamPrompt(briefFromConfirmedDescription(input.visualIntent, { ...input, includeQr: true, qrPayload: "https://example.com/signup", qrAssetId: "d681673d-2f98-48a8-a548-0a9efbd068b3" }));
    expect(withQr).toBe(withoutQr);
    expect(withQr).not.toContain("https://example.com/signup");
    expect(withQr).not.toContain("d681673d-2f98-48a8-a548-0a9efbd068b3");
  });
  it("describes empty regions without naming downstream poster elements", () => {
    expect(t01CompositionContract).not.toMatch(/二维码|扫码|QR|Logo|标题|页脚|报名/i);
    expect(t01CompositionContract).toContain("低纹理的自然背景");
  });
  it("adds mandatory exclusions to the existing saved brief contract", () => {
    const prompt = seedreamPrompt({ subject: "企业同事", action: "共同参与活动", setting: "开阔城市街道", composition: "同事在画面中部自然互动", palette: "黑白灰和黄色", style: "纪实摄影", mood: "活力", negative: "不要文字、字母、数字、Logo、二维码、水印、签名" });
    expect(prompt).toContain("【系统强制禁止】" + backgroundNegative);
    expect(prompt).not.toContain("留给二维码");
  });
});
