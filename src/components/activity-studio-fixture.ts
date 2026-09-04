import type { EmployeeActivityInput, PosterDocument } from "@/contracts/poster";

export const UI_FIXTURE_JOB_ID = "ui-fixture-local";
export const UI_FIXTURE_STORAGE_KEY = "ninebot-ui-fixture-job-v1";

export type ActivityStudioJob = {
  id?: string;
  status: string;
  currentStep: string;
  error?: { code: string; message: string };
  previewUrl?: string;
  copyDraft?: {
    document: PosterDocument;
    provider: string;
    model: string;
    createdAt: string;
  };
  visualInput?: {
    originalIntent: string;
    sourceCopyCreatedAt: string;
    createdAt: string;
  };
  visualDraft?: {
    description: string;
    provider: string;
    promptVersion: string;
    sourceCopyCreatedAt: string;
    createdAt: string;
    fallback: boolean;
  };
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
      checks?: {
        fontAndLogos: boolean;
        capacity: boolean;
        outputSize: boolean;
      };
      readability?: { passed: boolean; backgroundMode: string };
    };
  }>;
};

export function createFixtureCopyJob(
  input: EmployeeActivityInput,
  createdAt = new Date().toISOString()
): ActivityStudioJob {
  return {
    id: UI_FIXTURE_JOB_ID,
    status: "READY_FOR_COPY_REVIEW",
    currentStep: "Fixture 文案已准备",
    copyDraft: {
      document: fixtureDocument(input),
      provider: "ui-fixture",
      model: "deterministic-copy-v1",
      createdAt
    },
    versions: []
  };
}

export function createFixtureVisualDraftJob(
  job: ActivityStudioJob,
  visualIntent: string,
  createdAt = new Date().toISOString()
): ActivityStudioJob {
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
      description: `${visualIntent}\n\n构图：主体位于画面中下部，顶部保留标题与品牌安全区；画面不包含文字、Logo 或二维码。`,
      provider: "ui-fixture",
      promptVersion: "ui-fixture-visual-v1",
      sourceCopyCreatedAt: job.copyDraft.createdAt,
      createdAt,
      fallback: false
    }
  };
}

export function createFixtureReadyJob(
  job: ActivityStudioJob
): ActivityStudioJob {
  return {
    ...job,
    status: "READY_FOR_REVIEW",
    currentStep: "Fixture 海报已生成",
    previewUrl: "/fixtures/employee-activity-poster.svg",
    versions: [
      ...job.versions,
      {
        assetMode: "fallback",
        assetDetail: "前端交互演练固定成品，不调用模型或渲染器",
        outputFormat: "portrait_1080x1920",
        templateVersion: "ui-fixture-v1",
        modelInfo: {
          copyProvider: "ui-fixture",
          imageProvider: "ui-fixture"
        },
        validation: {
          passed: true,
          exportAllowed: true,
          strategy: "trial",
          messages: ["Fixture 模式：结构与交互演练通过，不代表真实生成质量。"],
          checks: {
            fontAndLogos: true,
            capacity: true,
            outputSize: true
          },
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
    subtitle: input.description,
    summary: input.description,
    sessions: input.sessions,
    audience: input.audience,
    highlights: input.highlights,
    participationSteps: input.participationSteps,
    notice: input.notice,
    includeQr: input.includeQr,
    ctaLabel: input.ctaLabel,
    qrPayload: input.qrPayload,
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
      notice: true
    }
  };
}
