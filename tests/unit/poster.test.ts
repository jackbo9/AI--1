import { describe, expect, it } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import twoSessions from "../fixtures/employee-activity.two-sessions.json";
import missing from "../fixtures/employee-activity.missing.json";
import {
  editablePosterContentSchema,
  employeeActivityInputSchema
} from "@/contracts/poster";
import { generateCopy } from "@/providers/copy-provider";
import { validatePoster } from "@/validation/poster-validation";
import {
  compileIllustrationBrief,
  t01CompositionContract,
  t01VisualStyleContract
} from "@/providers/prompt-compiler";
import { seedreamPrompt } from "@/providers/illustration-provider";
describe("employee activity v1.7 contract", () => {
  it("preserves immutable fields and locks the output format", async () => {
    const input = employeeActivityInputSchema.parse(normal);
    const { document } = await generateCopy(input);
    expect(input.outputFormat).toBe("portrait_1080x1920");
    expect(document.outputFormat).toBe(input.outputFormat);
    expect(document.sessions).toEqual(input.sessions);
    expect(document.audience).toBe(input.audience);
    expect(document.notice).toBe(input.notice);
    expect(validatePoster(input, document).passed).toBe(true);
  });

  it("accepts two sessions", () =>
    expect(employeeActivityInputSchema.parse(twoSessions).sessions).toHaveLength(
      2
    ));

  it("rejects a missing location", () =>
    expect(() => employeeActivityInputSchema.parse(missing)).toThrow());

  it("requires a valid link when QR is enabled", () => {
    expect(
      employeeActivityInputSchema.safeParse({
        ...normal,
        includeQr: true,
        qrPayload: ""
      }).success
    ).toBe(false);
    expect(
      employeeActivityInputSchema.safeParse({
        ...normal,
        includeQr: true,
        qrPayload: "https://example.com/register"
      }).success
    ).toBe(true);
  });

  it("accepts one uploaded QR asset and rejects ambiguous QR sources", () => {
    const qrAssetId = "b85ee8a8-3b8a-4eba-8cf1-9efcf4156a99";
    expect(
      employeeActivityInputSchema.safeParse({
        ...normal,
        includeQr: true,
        qrPayload: "",
        qrAssetId
      }).success
    ).toBe(true);
    expect(
      employeeActivityInputSchema.safeParse({
        ...normal,
        includeQr: true,
        qrPayload: "https://example.com/register",
        qrAssetId
      }).success
    ).toBe(false);
  });

  it("allows editing only the copy review fields", () => {
    const parsed = editablePosterContentSchema.parse({
      title: "秋日同行",
      subtitle: "和同事一起出发",
      summary: "一场轻松的内部员工活动。",
      highlights: ["轻松互动", "手作体验"],
      participationSteps: ["完成报名"]
    });
    expect(parsed.title).toBe("秋日同行");
    expect("sessions" in parsed).toBe(false);
    expect("audience" in parsed).toBe(false);
  });

  it("removes immutable details from the illustration brief", async () => {
    const input = employeeActivityInputSchema.parse({
      ...normal,
      visualIntent:
        "在上海总部一层多功能厅 2026-09-18 放入 Logo 和二维码，几位同事轻松互动"
    });
    const { brief } = await compileIllustrationBrief(input);
    expect(JSON.stringify(brief)).not.toContain("上海总部一层多功能厅");
    expect(JSON.stringify(brief)).not.toContain("2026-09-18");
    expect(brief.negative).toContain("Logo");
    expect(brief.composition).not.toContain(t01CompositionContract);
    expect(brief.composition).toContain("几位同事");
    expect(brief.style).toContain("摄影");
  });

  it("uses a labeled T01 photography prompt rather than a free-form cartoon brief", () => {
    const prompt = seedreamPrompt({
      subject: "企业同事",
      action: "轻松互动",
      setting: "开阔园区",
      composition: t01CompositionContract,
      palette: "黑白灰与行政黄",
      style: t01VisualStyleContract,
      mood: "克制自然",
      negative: "不要文字、字母、数字、Logo、二维码、水印、签名"
    });

    expect(prompt).toContain("【版式构图】");
    expect(prompt).toContain("原生竖版 9:16");
    expect(prompt).toContain("纪实摄影");
    expect(prompt).toContain("不是插画、卡通");
  });
});
