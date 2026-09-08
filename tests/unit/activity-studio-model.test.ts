import { describe, expect, it } from "vitest";
import {
  getStageForJob,
  getStatusLabel,
  initialForm,
  normalizeForm,
  validateForm
} from "@/components/activity-studio/activity-studio-model";
import type { ActivityJob } from "@/components/activity-studio/types";

function job(status: ActivityJob["status"], currentStep = "处理中"): ActivityJob {
  return { status, currentStep, versions: [] };
}

describe("activity studio model", () => {
  it("keeps the current form validation messages", () => {
    expect(validateForm({ ...initialForm, activityName: " " })).toBe(
      "请填写活动主题"
    );
    expect(
      validateForm({
        ...initialForm,
        session: { ...initialForm.session, location: " " }
      })
    ).toBe("请完整填写比赛日期和比赛地点");
    expect(validateForm({ ...initialForm, qrUrl: "example.com" })).toBe(
      "二维码 URL 必须以 http:// 或 https:// 开头"
    );
  });

  it("normalizes the form into the existing job request shape", () => {
    const input = normalizeForm({
      ...initialForm,
      activityName: "  夏日羽毛球挑战赛  ",
      rules: " 小组循环赛 \n\n 三局两胜 ",
      qrUrl: " https://example.com/signup "
    });

    expect(input).toMatchObject({
      outputFormat: "portrait_1080x1920",
      activityName: "夏日羽毛球挑战赛",
      participationSteps: ["小组循环赛", "三局两胜"],
      includeQr: true,
      qrPayload: "https://example.com/signup"
    });
  });

  it("maps backend statuses to the same stages and labels", () => {
    expect(getStageForJob(job("READY_FOR_COPY_REVIEW"))).toBe(1);
    expect(getStageForJob(job("READY_FOR_VISUAL_REVIEW"))).toBe(2);
    expect(getStageForJob(job("READY_FOR_REVIEW"))).toBe(3);
    expect(getStageForJob(job("GENERATING_COPY"))).toBeUndefined();

    expect(getStatusLabel()).toBe("填写完成后开始生成");
    expect(getStatusLabel(job("READY_FOR_COPY_REVIEW"))).toBe("文案待确认");
    expect(getStatusLabel(job("READY_FOR_VISUAL_INPUT"))).toBe("视觉待确认");
    expect(getStatusLabel(job("READY_FOR_REVIEW"))).toBe("海报已生成");
    expect(getStatusLabel(job("FAILED_FINAL"))).toBe("任务未完成");
    expect(getStatusLabel(job("GENERATING_COPY", "正在生成文案"))).toBe(
      "正在生成文案"
    );
  });
});
