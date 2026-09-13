import { describe, expect, it } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import {
  employeeActivityInputSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import {
  createT01BaseVisualDescription,
  createT01BaseVisualDraft
} from "@/providers/t01-base-visual";

const input = employeeActivityInputSchema.parse({
  ...normal,
  activityName: "羽球挑战赛",
  rules: "小组循环赛，三局两胜"
});

const document = posterDocumentSchema.parse({
  ...input,
  schemaVersion: "1.7",
  scene: "employee_activity",
  locale: "zh-CN",
  title: input.activityName,
  slogan: "九号员工羽球挑战赛 / BADMINTON",
  subtitle: "零基础也能参加",
  summary: "",
  immutableSource: {
    outputFormat: true,
    sessions: true,
    audience: true,
    contact: true,
    includeQr: true,
    ctaLabel: true,
    qrPayload: true,
    qrAssetId: true,
    notice: true
  }
});

describe("T01 base visual description", () => {
  it("starts from confirmed copy with subject, style, color and safe composition", () => {
    const description = createT01BaseVisualDescription(document);
    expect(description).toContain("赛事类型：羽毛球");
    expect(description).toContain("画面建议：");
    expect(description).toContain("色彩倾向：");
    expect(description).not.toContain("LEFT TOP = TITLE SAFE AREA");
    expect(description).not.toContain("默认不生成人物或人体");
    expect(description.length).toBeLessThanOrEqual(420);
    expect(description).not.toContain(input.sessions[0].date);
    expect(description).not.toContain(input.sessions[0].location);
  });

  it("binds the draft to the confirmed copy timestamp", () => {
    const draft = createT01BaseVisualDraft(
      document,
      "2026-09-08T08:00:00.000Z",
      "2026-09-08T08:00:01.000Z"
    );
    expect(draft.sourceCopyCreatedAt).toBe("2026-09-08T08:00:00.000Z");
    expect(draft.provider).toBe("t01-base-description");
    expect(draft.promptVersion).toBe("t01-sports-base-visual-v3-people");
    expect(draft.brief.subject).toContain("根据动作需要");
    expect(draft.brief.negative).toContain("Logo");
  });
});
