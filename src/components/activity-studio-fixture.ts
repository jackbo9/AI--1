import {
  t01PortraitSubtitleMaxCharacters,
  textCharacterCount,
  type EmployeeActivityInput,
  type VisualPreference,
  type PosterDocument
} from "@/contracts/poster";
import type { RenderTargetId } from "@/contracts/brand";
import { createT01BaseVisualDraft } from "@/providers/t01-base-visual";

export const UI_FIXTURE_JOB_ID = "ui-fixture-local";
export const UI_FIXTURE_STORAGE_KEY = "ninebot-ui-fixture-job-v2";

export type ActivityStudioFixtureJob = {
  previousJobId?: string;
  visualBatches?: import("@/contracts/job").VisualBatch[];
  id?: string;
  status: string;
  currentStep: string;
  error?: { code: string; message: string };
  previewUrl?: string;
  campaignBrief?: { renderTargets: RenderTargetId[] };
  copyDraft?: {
    document: PosterDocument;
    provider: string;
    model: string;
    createdAt: string;
  };
  visualInput?: {
    preferences?: VisualPreference;
    originalIntent: string;
    sourceCopyCreatedAt: string;
    createdAt: string;
  };
  visualDraft?: {
    preferences?: VisualPreference;
    sportType?: string;
    description: string;
    provider: string;
    promptVersion: string;
    sourceCopyCreatedAt: string;
    createdAt: string;
    fallback: boolean;
  };
  confirmedVisual?: {
    preferences?: VisualPreference;
    description: string;
    sourceDraftCreatedAt: string;
    sourceCopyCreatedAt?: string;
    createdAt: string;
  };
  visualOptions?: Array<{
    brief?: import("@/contracts/poster").IllustrationBrief;
    id: string;
    createdAt: string;
    description: string;
    sourceDraftCreatedAt: string;
    sourceCopyCreatedAt: string;
    sourceDocumentVersionId: string;
    sourceDocument: PosterDocument;
    promptVersion: string;
    previewUrl: string;
    assetMode: "generated" | "fallback";
    assetDetail?: string;
    imageProvider: string;
    imageModel: string;
  }>;
  selectedVisualOptionId?: string;
  confirmedVisualOptionId?: string;
  versions: Array<{
    assetMode: string;
    assetDetail?: string;
    outputFormat: string;
    templateVersion: string;
    modelInfo: { copyProvider: string; imageProvider: string };
    validation: {
      passed: boolean;
      exportAllowed?: boolean;
      strategy?: "strict" | "trial";
      messages: string[];
      checks?: { fontAndLogos: boolean; capacity: boolean; outputSize: boolean };
      readability?: { passed: boolean; backgroundMode: string };
    };
  }>;
};

export function createFixtureCopyJob(
  input: EmployeeActivityInput,
  createdAt = new Date().toISOString()
): ActivityStudioFixtureJob {
  return {
    id: UI_FIXTURE_JOB_ID,
    status: "READY_FOR_COPY_REVIEW",
    currentStep: "Fixture 文案已准备",
    copyDraft: {
      document: fixtureDocument(input),
      provider: "ui-fixture",
      model: "deterministic-copy-v2",
      createdAt
    },
    versions: []
  };
}

export function createFixtureVisualDraftJob(
  job: ActivityStudioFixtureJob,
  visualIntent: string,
  createdAt = new Date().toISOString()
): ActivityStudioFixtureJob {
  if (!job.copyDraft) throw new Error("Fixture 文案不存在");
  return {
    ...job,
    status: "READY_FOR_VISUAL_REVIEW",
    currentStep: "Fixture 画面描述已准备",
    visualInput: {
      originalIntent: visualIntent,
      sourceCopyCreatedAt: job.copyDraft.createdAt,
      createdAt
    },
    visualDraft: {
      description: `${visualIntent}\n\n构图：左上保持干净留白，主体位于中右区域；画面不包含文字、Logo 或二维码。`,
      provider: "ui-fixture",
      promptVersion: "ui-fixture-visual-v2",
      sourceCopyCreatedAt: job.copyDraft.createdAt,
      createdAt,
      fallback: false
    }
  };
}

export function createFixtureBaseVisualJob(
  input: EmployeeActivityInput,
  createdAt = new Date().toISOString()
): ActivityStudioFixtureJob {
  const copyJob = createFixtureCopyJob(input, createdAt);
  const document = copyJob.copyDraft!.document;
  const visualDraft = createT01BaseVisualDraft(
    document,
    createdAt,
    createdAt
  );
  return {
    ...copyJob,
    status: "READY_FOR_VISUAL_REVIEW",
    currentStep: "Fixture 基础视觉描述已准备",
    visualInput: {
      originalIntent: visualDraft.description,
      sourceCopyCreatedAt: createdAt,
      createdAt
    },
    visualDraft: {
      description: visualDraft.description,
      provider: visualDraft.provider,
      promptVersion: visualDraft.promptVersion,
      sourceCopyCreatedAt: createdAt,
      createdAt,
      fallback: false
    }
  };
}

export function createFixtureBaseVisualJobFromCopy(
  job: ActivityStudioFixtureJob,
  createdAt = new Date().toISOString()
): ActivityStudioFixtureJob {
  if (!job.copyDraft) throw new Error("Fixture 文案不存在");
  const copyDraft = { ...job.copyDraft, createdAt };
  const visualDraft = createT01BaseVisualDraft(
    copyDraft.document,
    createdAt,
    createdAt
  );
  return {
    ...job,
    status: "READY_FOR_VISUAL_REVIEW",
    currentStep: "Fixture 基础视觉描述已准备",
    copyDraft,
    visualInput: {
      originalIntent: visualDraft.description,
      sourceCopyCreatedAt: createdAt,
      createdAt
    },
    visualDraft: {
      description: visualDraft.description,
      provider: visualDraft.provider,
      promptVersion: visualDraft.promptVersion,
      sourceCopyCreatedAt: createdAt,
      createdAt,
      fallback: false
    },
    confirmedVisual: undefined
  };
}

export function createFixtureVisualOptionJob(
  job: ActivityStudioFixtureJob,
  description: string,
  createdAt = new Date().toISOString()
): ActivityStudioFixtureJob {
  if (!job.copyDraft || !job.visualDraft) {
    throw new Error("Fixture 视觉描述不存在");
  }
  const optionId = `fixture-option-${(job.visualOptions?.length ?? 0) + 1}`;
  return {
    ...job,
    status: "READY_FOR_VISUAL_REVIEW",
    currentStep: "Fixture 主视觉方案已生成，等待选择",
    visualOptions: [
      ...(job.visualOptions ?? []),
      {
        id: optionId,
        createdAt,
        description,
        sourceDraftCreatedAt: job.visualDraft.createdAt,
        sourceCopyCreatedAt: job.copyDraft.createdAt,
        sourceDocumentVersionId: `fixture-document-${job.copyDraft.createdAt}`,
        sourceDocument: job.copyDraft.document,
        promptVersion: job.visualDraft.promptVersion,
        previewUrl: "/brand/employee-activity-fallback.svg",
        assetMode: "fallback",
        assetDetail: "Fixture 固定主视觉，不调用图片模型",
        imageProvider: "ui-fixture",
        imageModel: "ui-fixture"
      }
    ],
    selectedVisualOptionId: optionId,
    confirmedVisual: {
      description,
      sourceDraftCreatedAt: job.visualDraft.createdAt,
      sourceCopyCreatedAt: job.copyDraft.createdAt,
      createdAt
    }
  };
}

export function createFixtureReadyJob(
  job: ActivityStudioFixtureJob,
  optionId = job.selectedVisualOptionId
): ActivityStudioFixtureJob {
  if (!optionId || !job.visualOptions?.some((option) => option.id === optionId)) {
    throw new Error("Fixture 主视觉方案未选中");
  }
  return {
    ...job,
    status: "READY_FOR_REVIEW",
    currentStep: "Fixture 海报已生成",
    selectedVisualOptionId: optionId,
    confirmedVisualOptionId: optionId,
    previewUrl: "/fixtures/employee-activity-poster.svg",
    versions: [
      ...job.versions,
      {
        assetMode: "fallback",
        assetDetail: "前端交互演练固定成品，不调用模型或渲染器",
        outputFormat: "portrait_1080x1920",
        templateVersion: "ui-fixture-v2",
        modelInfo: {
          copyProvider: "ui-fixture",
          imageProvider: "ui-fixture"
        },
        validation: {
          passed: true,
          exportAllowed: true,
          strategy: "trial",
          messages: ["Fixture 模式：仅验证交互流，不代表真实生成或品牌质量。"],
          checks: { fontAndLogos: true, capacity: true, outputSize: true },
          readability: { passed: true, backgroundMode: "fixture" }
        }
      }
    ]
  };
}

function fixtureDocument(input: EmployeeActivityInput): PosterDocument {
  return {
    schemaVersion: "1.7",
    scene: "employee_activity",
    locale: "zh-CN",
    outputFormat: input.outputFormat,
    category: input.category,
    title: input.activityName,
    slogan: input.slogan,
    subtitle: input.subtitle || fixtureSubtitle(input.description),
    summary: input.description,
    sessions: input.sessions,
    audience: input.audience,
    highlights: input.highlights,
    participationSteps: input.participationSteps,
    notice: input.notice,
    includeQr: input.includeQr,
    ctaLabel: input.ctaLabel,
    qrPayload: input.qrPayload,
    qrAssetId: input.qrAssetId,
    contact: input.contact,
    deadline: input.deadline,
    rules: input.rules,
    prize: input.prize,
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
  };
}

function fixtureSubtitle(description: string) {
  const firstSentence = description.trim().split(/[。！？!?]/, 1)[0]?.trim() ?? "";
  return textCharacterCount(firstSentence) <= t01PortraitSubtitleMaxCharacters
    ? firstSentence
    : "活动详情请见报名说明";
}
