import {
  t01PortraitTitleMaxCharacters,
  textCharacterCount,
  type EmployeeActivityInput,
  type PosterDocument
} from "@/contracts/poster";
import type { RenderTargetId } from "@/contracts/brand";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import type {
  ActivityJob,
  CopyReview,
  FormState,
  Stage
} from "./types";

export const initialForm: FormState = {
  renderTargets: ["portrait_1080x1920"],
  activityName: "羽球挑战赛",
  session: {
    date: "2026-09-18",
    time: "18:30–20:30",
    location: "九号园区体育馆"
  },
  audience: "全体员工",
  supplement: "零基础也能参加，现场自由组队",
  deadline: "9月16日 18:00",
  contact: "行政服务台",
  rules: "小组循环赛\n三局两胜",
  prize: "冠军运动礼包\n参与纪念礼",
  qrUrl: "",
  qrAssetId: "",
  qrAssetName: ""
};

export function newFormState(): FormState {
  return {
    ...initialForm,
    renderTargets: [...initialForm.renderTargets],
    session: { ...initialForm.session }
  };
}

export const renderTargetOptions: Array<{
  id: RenderTargetId;
  name: string;
  size: string;
  detail: string;
  visualGroup: "portrait" | "landscape" | "banner";
}> = [
  {
    id: "portrait_1080x1920",
    name: "竖版海报",
    size: "1080 × 1920",
    detail: "通用活动海报",
    visualGroup: "portrait"
  },
  {
    id: "landscape_1920x1080",
    name: "横版海报",
    size: "1920 × 1080",
    detail: "屏幕与横向展示",
    visualGroup: "landscape"
  },
  {
    id: "banner_2227x950",
    name: "Banner",
    size: "2227 × 950",
    detail: "横幅与头图",
    visualGroup: "banner"
  },
  {
    id: "longform_1080xAuto",
    name: "长图",
    size: "1080 × 自适应",
    detail: "承载完整活动信息",
    visualGroup: "portrait"
  }
];

export const scenes = [
  ["01", "员工活动", "节日 / 安全 / 差旅 / 体育赛事 / 员工俱乐部", "当前切片"],
  ["02", "员工福利", "下午茶 / 周边折扣 / 体检与商务保险 / 员工关怀", "后续开放"],
  ["03", "员工通知", "安全通知 / 温馨提示 / 截止提醒", "后续开放"],
  ["04", "调查问卷", "满意度调研 / 体验改善 / 行政调研", "后续开放"]
] as const;

export const stages: Array<[Stage, string]> = [
  [1, "填写需求"],
  [2, "确认文案"],
  [3, "生成主视觉"],
  [4, "排版导出"]
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
  if (job.status === "READY_FOR_COPY_REVIEW") return 2;
  if (
    ["READY_FOR_VISUAL_INPUT", "REFINING_VISUAL", "READY_FOR_VISUAL_REVIEW"].includes(
      job.status
    )
  ) {
    return 3;
  }
  if (job.status === "READY_FOR_REVIEW") return 4;
  return undefined;
}

export function hydrateForm(current: FormState, job: ActivityJob): FormState {
  const document = job.copyDraft?.document;
  if (!document) return current;
  return {
    ...current,
    renderTargets: job.renderTargets?.length
      ? job.renderTargets
      : current.renderTargets,
    activityName: document.title,
    session: document.sessions[0] ?? current.session,
    secondSession: document.sessions[1]
      ? {
          date: document.sessions[1].date,
          time: document.sessions[1].time,
          location: document.sessions[1].location
        }
      : undefined,
    audience: document.audience,
    supplement: document.subtitle || document.summary,
    rules: document.rules ?? "",
    prize: document.prize ?? "",
    qrUrl: document.qrPayload,
    qrAssetId: document.qrAssetId,
    qrAssetPreviewUrl: document.qrAssetId
      ? `/api/uploads/qr/${document.qrAssetId}`
      : undefined,
    qrAssetName: document.qrAssetId ? "已上传二维码图片" : "",
    contact: document.contact,
    deadline: document.deadline ?? ""
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

export function validateForm(form: FormState) {
  if (!form.renderTargets.length) return "请至少选择一种输出尺寸";
  if (!form.activityName.trim()) return "请填写活动主题";
  if (textCharacterCount(form.activityName) > t01PortraitTitleMaxCharacters) {
    return `T01 竖版主题最多 ${t01PortraitTitleMaxCharacters} 个字，请精简后再生成`;
  }
  const sessions = [
    form.session,
    ...(form.secondSession ? [form.secondSession] : [])
  ];
  if (
    sessions.some(
      (session) =>
        !session.date || !session.time.trim() || !session.location.trim()
    )
  ) {
    return "请完整填写每一场的日期、时间和地点";
  }
  if (!form.audience.trim()) return "请填写参与对象";
  if (form.qrUrl && !/^https?:\/\//i.test(form.qrUrl)) {
    return "二维码 URL 必须以 http:// 或 https:// 开头";
  }
  if (form.qrUrl && form.qrAssetId) return "二维码链接与上传图片只能选择一种";
  return undefined;
}

export function normalizeForm(form: FormState): EmployeeActivityInput {
  const sessions = [
    form.session,
    ...(form.secondSession ? [form.secondSession] : [])
  ];
  return {
    outputFormat: "portrait_1080x1920",
    activityName: form.activityName.trim(),
    category: "team",
    themeKeywords: [],
    description: form.supplement.trim(),
    sessions: sessions.map((session, index) => ({
      label: index === 0 ? "第一场" : "第二场",
      date: session.date,
      time: session.time.trim(),
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
    contact: form.contact.trim(),
    visualIntent: "",
    deadline: form.deadline.trim(),
    rules: form.rules.trim(),
    prize: form.prize.trim()
  };
}
