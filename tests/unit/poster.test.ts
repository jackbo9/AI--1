import { describe, expect, it } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import twoSessions from "../fixtures/employee-activity.two-sessions.json";
import missing from "../fixtures/employee-activity.missing.json";
import { employeeActivityInputSchema } from "@/contracts/poster";
import { generateCopy } from "@/providers/copy-provider";
import { validatePoster } from "@/validation/poster-validation";
import { compileIllustrationBrief } from "@/providers/prompt-compiler";
describe("employee activity v1.5 contract", () => { it("preserves sessions and notices", async () => { const input = employeeActivityInputSchema.parse(normal); const { document } = await generateCopy(input); expect(document.sessions).toEqual(input.sessions); expect(document.notice).toBe(input.notice); expect(validatePoster(input, document).passed).toBe(true); }); it("accepts two sessions", () => expect(employeeActivityInputSchema.parse(twoSessions).sessions).toHaveLength(2)); it("rejects a missing location", () => expect(() => employeeActivityInputSchema.parse(missing)).toThrow()); it("removes immutable details from the illustration brief", async () => { const input = employeeActivityInputSchema.parse({ ...normal, visualIntent: "在上海总部一层多功能厅 2026-09-18 放入 Logo 和二维码，几位同事轻松互动" }); const { brief } = await compileIllustrationBrief(input); expect(JSON.stringify(brief)).not.toContain("上海总部一层多功能厅"); expect(JSON.stringify(brief)).not.toContain("2026-09-18"); expect(brief.negative).toContain("Logo"); }); });
