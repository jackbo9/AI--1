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
import { compileIllustrationBrief } from "@/providers/prompt-compiler";
describe("employee activity v1.6 contract", () => {
  it("preserves immutable fields and locks the output format", async () => {
    const input = employeeActivityInputSchema.parse(normal);
    const { document } = await generateCopy(input);
    expect(input.outputFormat).toBe("portrait_1080x1920");
    expect(document.outputFormat).toBe(input.outputFormat);
    expect(document.sessions).toEqual(input.sessions);
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
  });
});
