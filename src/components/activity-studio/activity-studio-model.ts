import { type EmployeeActivityInput, type PosterDocument } from "@/contracts/poster";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import type {
  ActivityJob,
  CopyReview,
  FormState,
  Stage
} from "./types";

export const initialForm: FormState = {
  renderTargets: ["portrait_1080x1920"],
  activeRenderTarget: "portrait_1080x1920",
  activityName: "羽球挑战赛",
  slogan: "一起上场，热爱不设限",
  subtitle: "零基础也能参加，现场自由组队",
  session: {
    date: "2026-09-18",
    time: "",
    location: "九号园区体育馆"
  },
  audience: "全体员工",
  rules: "小组循环赛\n三局两胜",
  qrUrl: "",
  qrAssetId: "",
  qrAssetName: ""
};

export function newFormState(): FormState {
  return { ...initialForm, session: { ...initialForm.session } };
}

export const scenes = [
  ["01", "员工活动", "节日 / 安全 / 差旅 / 体育赛事 / 员工俱乐部", "当前切片"],
  ["02", "员工福利", "下午茶 / 周边折扣 / 体检与商务保险 / 员工关怀", "后续开放"],
  ["03", "员工通知", "安全通知 / 温馨提示 / 截止提醒", "后续开放"],
  ["04", "调查问卷", "满意度调研 / 体验改善 / 行政调研", "后续开放"]
] as const;

export const stages: Array<[Stage, string]> = [
  [1, "填写与确认文案"],
  [2, "生成主视觉"],
  [3, "查看与下载"]
];

export const workingStatuses = [
  "QUEUED",
  "VALIDATING_INPUT",
  "GENERATING_COPY",
  "REFINING_VISUAL",
  "GENERATING_ASSET",
  "RENDERING",
  "VALIDATING_OUTPUT"
] as const;

export function isJobWorking(job?: ActivityJob) {
  return Boolean(
    job && workingStatuses.some((status) => status === job.status)
  );
}

export function createCopyReview(job: ActivityJob): CopyReview | undefined {
  if (!job.copyDraft) return undefined;
  return {
    subtitle: job.copyDraft.document.subtitle,
    summary: job.copyDraft.document.summary,
    rules: job.copyDraft.document.rules ?? "",
    prize: job.copyDraft.document.prize ?? ""
  };
}

export function getStageForJob(job: ActivityJob): Stage | undefined {
  if (job.status === "READY_FOR_COPY_REVIEW") return 1;
  if (
    ["READY_FOR_VISUAL_INPUT", "REFINING_VISUAL", "READY_FOR_VISUAL_REVIEW"].includes(
      job.status
    )
  ) {
    return 2;
  }
  if (job.status === "READY_FOR_REVIEW") return 3;
  return undefined;
}

export function hydrateForm(current: FormState, job: ActivityJob): FormState {
  const document = job.copyDraft?.document;
  if (!document) return current;
  const renderTargets = job.campaignBrief?.renderTargets?.length
    ? job.campaignBrief.renderTargets
    : current.renderTargets;
  return {
    ...current,
    renderTargets,
    activeRenderTarget: renderTargets.includes(current.activeRenderTarget)
      ? current.activeRenderTarget
      : renderTargets[0]!,
    activityName: document.title,
    slogan: document.slogan,
    subtitle: document.subtitle,
    session: document.sessions[0] ?? current.session,
    audience: document.audience,
    rules: document.rules ?? "",
    qrUrl: document.qrPayload,
    qrAssetId: document.qrAssetId,
    qrAssetPreviewUrl: document.qrAssetId
      ? `/api/uploads/qr/${document.qrAssetId}`
      : undefined,
    qrAssetName: document.qrAssetId ? "已上传二维码图片" : "",
  };
}

export function createPreviewCopy(
  job: ActivityJob | undefined,
  copyReview: CopyReview | undefined
): PosterDocument | undefined {
  if (!job?.copyDraft?.document || !copyReview) return job?.copyDraft?.document;
  return {
    ...job.copyDraft.document,
    subtitle: copyReview.subtitle,
    summary: copyReview.summary,
    rules: copyReview.rules,
    prize: copyReview.prize,
    participationSteps: normalizeLines(splitDraftLines(copyReview.rules))
  };
}

export function getStatusLabel(job?: ActivityJob) {
  if (!job) return "填写完成后开始生成";
  if (job.status === "READY_FOR_COPY_REVIEW") return "文案待确认";
  if (["READY_FOR_VISUAL_INPUT", "READY_FOR_VISUAL_REVIEW"].includes(job.status)) {
    return "视觉待确认";
  }
  if (job.status === "READY_FOR_REVIEW") return "海报已生成";
  if (job.status === "FAILED_FINAL") return "任务未完成";
  return job.currentStep;
}

export function validateForm(form: FormState, requireTitleCompanions = true) {
  if (!form.activityName.trim()) return "请填写活动主题";
  if (!form.renderTargets.length) return "请至少选择一款 T01 模板";
  const needsActivityFacts = form.renderTargets.some((format) => format !== "banner_2227x950");
  if (needsActivityFacts) {
    if (!form.session.date || !form.session.location.trim()) return "请完整填写比赛日期和比赛地点";
    if (!form.audience.trim()) return "请填写参与对象";
    if (!form.rules.trim()) return "请填写赛事规则";
  }
  if (requireTitleCompanions && !form.slogan.trim()) return "请填写宣言标题，或使用 AI 辅助生成";
  if (requireTitleCompanions && !form.subtitle.trim()) return "请填写副标题，或使用 AI 辅助生成";
  if (form.qrUrl && !/^https?:\/\//i.test(form.qrUrl)) {
    return "二维码 URL 必须以 http:// 或 https:// 开头";
  }
  if (form.qrUrl && form.qrAssetId) return "二维码链接与上传图片只能选择一种";
  return undefined;
}

export function normalizeForm(form: FormState): EmployeeActivityInput {
  return {
    outputFormat: "portrait_1080x1920",
    activityName: form.activityName.trim(),
    category: "team",
    themeKeywords: [],
    description: "",
    slogan: form.slogan.trim(),
    subtitle: form.subtitle.trim(),
    sessions: [form.session].map((session) => ({
      label: "活动安排",
      date: session.date,
      time: "",
      location: session.location.trim(),
      details: []
    })),
    audience: form.audience.trim(),
    highlights: [],
    participationSteps: normalizeLines(splitDraftLines(form.rules)),
    notice: "",
    includeQr: Boolean(form.qrUrl || form.qrAssetId),
    ctaLabel: "",
    qrPayload: form.qrUrl.trim(),
    qrAssetId: form.qrAssetId,
    contact: "",
    visualIntent: "",
    deadline: "",
    rules: form.rules.trim(),
    prize: ""
  };
}
