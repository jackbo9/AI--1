import { describe, expect, it } from "vitest";
import {
  getStageForJob,
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
      validateForm({ ...initialForm, activityName: "第一行\n第二行\n第三行" })
    ).toBe("一级大标题最多 2 行，请删除多余换行");
    expect(
      validateForm({
        ...initialForm,
        session: { ...initialForm.session, location: " " }
      })
    ).toBe("请完整填写比赛日期和比赛地点");
    expect(validateForm({ ...initialForm, qrUrl: "example.com" })).toBe(
      "二维码 URL 必须以 http:// 或 https:// 开头"
    );
    expect(validateForm(initialForm)).toBe("竖版和横版海报需要添加报名二维码");
    expect(validateForm(initialForm, false, false)).toBeUndefined();
    expect(
      validateForm({
        ...initialForm,
        renderTargets: ["banner_2227x950"]
      })
    ).toBeUndefined();
  });

  it("does not silently turn non-sports content into a sports visual", () => {
    expect(validateForm({ ...initialForm, activityName: "中秋下午茶", rules: "自由参加", sportType: "auto" })).toBe("未识别到体育项目。当前模板仅生成体育赛事主视觉，请明确选择体育项目；非体育活动请改用对应场景。");
    expect(validateForm({ ...initialForm, activityName: "桌游联谊", sportType: "other", sportsConfirmed: false })).toBe("请选择“确认这是体育赛事”后继续生成。");
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

  it("requires all fixed groups only when the longform target is selected", () => {
    expect(validateForm({
      ...initialForm,
      renderTargets: ["longform_1080xAuto"],
      finalistGroups: initialForm.finalistGroups.map((group, index) => index === 0
        ? { ...group, entrants: [] }
        : { ...group, entrants: [{ name: "测试选手", region: "华东赛区" }] })
    })).toBe("男单至少需要填写 1 人");
    expect(validateForm({
      ...initialForm,
      renderTargets: ["banner_2227x950"],
      finalistGroups: initialForm.finalistGroups.map((group) => ({ ...group, entrants: [] }))
    })).toBeUndefined();
  });

  it("preserves an intentional title line break", () => {
    expect(
      normalizeForm({
        ...initialForm,
        activityName: "  夏日羽球\n热爱不设限  "
      }).activityName
    ).toBe("夏日羽球\n热爱不设限");
  });

  it("maps backend statuses to the same stages", () => {
    expect(getStageForJob(job("READY_FOR_COPY_REVIEW"))).toBe(1);
    expect(getStageForJob(job("READY_FOR_VISUAL_REVIEW"))).toBe(2);
    expect(getStageForJob(job("READY_FOR_REVIEW"))).toBe(3);
    expect(getStageForJob(job("GENERATING_COPY"))).toBeUndefined();

  });
});
