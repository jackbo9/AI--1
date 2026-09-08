import { describe, expect, it } from "vitest";
import {
  createFixtureCopyJob,
  createFixtureReadyJob,
  createFixtureVisualOptionJob,
  createFixtureVisualDraftJob,
  UI_FIXTURE_JOB_ID
} from "@/components/activity-studio-fixture";
import {
  employeeActivityInputSchema,
  t01PortraitSubtitleMaxCharacters
} from "@/contracts/poster";

const input = employeeActivityInputSchema.parse({
  outputFormat: "portrait_1080x1920",
  activityName: "羽球挑战赛",
  category: "team",
  themeKeywords: [],
  description: "零基础也能参加，现场自由组队。",
  sessions: [
    {
      label: "第一场",
      date: "2026-09-18",
      time: "18:30–20:30",
      location: "九号园区体育馆",
      details: []
    }
  ],
  audience: "全体员工",
  highlights: [],
  participationSteps: ["小组循环赛"],
  notice: "",
  includeQr: false,
  ctaLabel: "",
  qrPayload: "",
  qrAssetId: "",
  contact: "行政服务台",
  visualIntent: "",
  deadline: "9月16日 18:00",
  rules: "小组循环赛",
  prize: "参与纪念礼"
});

describe("activity studio UI fixture", () => {
  it("preserves current T01 text and QR contracts through the fixture flow", () => {
    const copyJob = createFixtureCopyJob(input, "2026-09-04T08:00:00.000Z");
    const visualJob = createFixtureVisualDraftJob(
      copyJob,
      "几位同事在室内羽毛球场轻松对打",
      "2026-09-04T08:01:00.000Z"
    );
    const optionJob = createFixtureVisualOptionJob(
      visualJob,
      visualJob.visualDraft!.description,
      "2026-09-04T08:02:00.000Z"
    );
    const readyJob = createFixtureReadyJob(optionJob);

    expect(copyJob.id).toBe(UI_FIXTURE_JOB_ID);
    expect(copyJob.copyDraft?.document.title).toBe(input.activityName);
    expect(copyJob.copyDraft?.document.qrAssetId).toBe("");
    expect(
      Array.from(copyJob.copyDraft?.document.subtitle ?? "").length
    ).toBeLessThanOrEqual(t01PortraitSubtitleMaxCharacters);
    expect(visualJob.status).toBe("READY_FOR_VISUAL_REVIEW");
    expect(visualJob.visualDraft?.description).toContain("左上保持干净留白");
    expect(optionJob.visualOptions).toHaveLength(1);
    expect(optionJob.selectedVisualOptionId).toBe(optionJob.visualOptions?.[0]?.id);
    expect(readyJob.status).toBe("READY_FOR_REVIEW");
    expect(readyJob.confirmedVisualOptionId).toBe(optionJob.selectedVisualOptionId);
    expect(readyJob.previewUrl).toBe("/fixtures/employee-activity-poster.svg");
  });
});
