import { finalistGroupLabels, isRecognizedSportsActivity, textLineCount, t01PortraitTitleMaxLines, type EmployeeActivityInput, type PosterDocument } from "@/contracts/poster";
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
  qrAssetName: "",
  finalistGroups: finalistGroupLabels.map((label) => ({ label, entrants: [{ name: "", region: "" }] })),
  sportType: "auto",
  themeColor: "auto",
  peopleMode: "auto",
  visualType: "auto",
  visualTreatment: "",
  sportsConfirmed: false
};

export function newFormState(): FormState {
  return { ...initialForm, session: { ...initialForm.session }, finalistGroups: initialForm.finalistGroups.map((group) => ({ ...group, entrants: group.entrants.map((entrant) => ({ ...entrant })) })) };
}

export const scenes = [
  ["01", "员工活动", "羽毛球、篮球、足球等企业赛事"],
  ["02", "员工福利", "下午茶 / 周边折扣 / 体检与商务保险 / 员工关怀"],
  ["03", "员工通知", "安全通知 / 温馨提示 / 截止提醒"],
  ["04", "调查问卷", "满意度调研 / 体验改善 / 行政调研"]
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
    [
      "READY_FOR_VISUAL_INPUT",
      "REFINING_VISUAL",
      "READY_FOR_VISUAL_REVIEW",
      "GENERATING_ASSET"
    ].includes(
      job.status
    )
  ) {
    return 2;
  }
  if (
    ["RENDERING", "VALIDATING_OUTPUT", "READY_FOR_REVIEW"].includes(job.status)
  ) {
    return 3;
  }
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
    finalistGroups: document.finalistGroups?.length
      ? document.finalistGroups
      : current.finalistGroups,
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

export function validateForm(
  form: FormState,
  requireTitleCompanions = true,
  requireQr = true
) {
  if (!form.activityName.trim()) return "请填写活动主题";
  if (textLineCount(form.activityName) > t01PortraitTitleMaxLines) {
    return `一级大标题最多 ${t01PortraitTitleMaxLines} 行，请删除多余换行`;
  }
  if (!form.renderTargets.length) return "请至少选择一种海报尺寸";
  if (form.sportType === "auto" && !isRecognizedSportsActivity(`${form.activityName} ${form.rules}`)) {
    return "未识别到体育项目。当前模板仅生成体育赛事主视觉，请明确选择体育项目；非体育活动请改用对应场景。";
  }
  if (form.sportType === "other" && !form.sportsConfirmed) return "请选择“确认这是体育赛事”后继续生成。";
  const needsActivityFacts = form.renderTargets.some((format) => format !== "banner_2227x950");
  if (needsActivityFacts) {
    if (!form.session.date || !form.session.location.trim()) return "请完整填写比赛日期和比赛地点";
    if (!form.audience.trim()) return "请填写参与对象";
    if (!form.rules.trim()) return "请填写赛事规则";
  }
  if (requireTitleCompanions && !form.slogan.trim()) return "请填写宣言标题，或使用 AI 辅助生成";
  if (requireTitleCompanions && !form.subtitle.trim()) return "请填写副标题，或使用 AI 辅助生成";
  const requiresQr = form.renderTargets.some(
    (target) => target === "portrait_1080x1920" || target === "landscape_1920x1080"
  );
  if (requireQr && requiresQr && !form.qrUrl.trim() && !form.qrAssetId) {
    return "竖版和横版海报需要添加报名二维码";
  }
  if (form.qrUrl && !/^https?:\/\//i.test(form.qrUrl)) {
    return "二维码 URL 必须以 http:// 或 https:// 开头";
  }
  if (form.qrUrl && form.qrAssetId) return "二维码链接与上传图片只能选择一种";
  return undefined;
}

/**
 * Incomplete roster rows are a form draft, not poster data. Keeping them out
 * of the document lets the live preview and copy/visual flow continue while
 * the user fills the remaining groups. Completed entries remain available to
 * the longform projection; empty groups are simply not rendered.
 */
export function completedFinalistGroups(form: Pick<FormState, "finalistGroups">) {
  const groups = form.finalistGroups
    .map((group) => ({
      label: group.label,
      entrants: group.entrants.flatMap((entrant) => {
        const name = entrant.name.trim();
        const region = entrant.region.trim();
        return name && region ? [{ name, region }] : [];
      })
    }))
    .filter((group) => group.entrants.length > 0);

  return groups.length ? groups : undefined;
}

export function normalizeForm(form: FormState): EmployeeActivityInput {
  // The roster editor keeps its draft while the user switches output sizes, so
  // they do not lose work when they reselect the longform. It is not, however,
  // part of a portrait/landscape/banner request. In particular, the initial
  // roster contains intentionally blank rows; sending them to the API makes
  // the entrant schema reject an otherwise valid request before copy
  // assistance or preview generation can begin.
  const finalistGroups = form.renderTargets.includes("longform_1080xAuto")
    ? completedFinalistGroups(form)
    : undefined;

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
    prize: "",
    finalistGroups,
    sportType: form.sportType,
    themeColor: form.themeColor,
    peopleMode: form.peopleMode,
    visualType: form.visualType,
    visualTreatment: form.visualTreatment.trim(),
    sportsConfirmed: form.sportsConfirmed
  };
}
