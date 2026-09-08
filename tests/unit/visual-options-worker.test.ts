import { beforeEach, describe, expect, it, vi } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import {
  campaignBriefFromLegacyInput,
  confirmedCampaignDocumentFromPoster,
  employeeActivityInputSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import type {
  CampaignGenerationJob
} from "@/contracts/job";
import { findJob, updateJob } from "@/server/job-store";
import {
  generateIllustration
} from "@/providers/illustration-provider";
import {
  renderEmployeeActivity
} from "@/templates/employee-activity";
import {
  runSelectedVisualStage,
  runVisualStage
} from "@/worker/run-job";

const brief = {
  confirmedDescription: "羽毛球高速飞行，真实体育摄影，蓝白主色，主体位于中右区域。",
  visualStyleMode: "editorial" as const,
  subject: "羽毛球与球拍",
  action: "高速飞行",
  setting: "专业球场",
  composition: "主体位于中右",
  palette: "蓝白",
  style: "真实体育摄影",
  mood: "快速有力",
  negative: "不要文字、字母、数字、Logo、二维码、水印、签名" as const
};

vi.mock("@/server/job-store", () => ({
  findJob: vi.fn(),
  updateJob: vi.fn()
}));
vi.mock("@/providers/copy-provider", () => ({
  generateCopy: vi.fn()
}));
vi.mock("@/providers/prompt-compiler", () => ({
  briefFromConfirmedDescription: vi.fn(() => brief),
  compileIllustrationBrief: vi.fn()
}));
vi.mock("@/providers/illustration-provider", () => ({
  generateIllustration: vi.fn(),
  seedreamPrompt: vi.fn(() => "valid prompt")
}));
vi.mock("@/templates/employee-activity", () => ({
  employeeActivityTemplate: { id: "employee-activity", version: "t01-test" },
  preflightEmployeeActivity: vi.fn(),
  renderEmployeeActivity: vi.fn(),
  PosterRenderError: class extends Error {
    code = "POSTER_RENDER_FAILED";
  }
}));
vi.mock("@/validation/poster-validation", () => ({
  validatePoster: vi.fn(() => ({ passed: true, messages: [] }))
}));
vi.mock("@/server/qr-asset-store", () => ({
  readOwnedQrAssetDataUri: vi.fn()
}));
vi.mock("@/server/t01-format-service", () => ({
  claimFormat: vi.fn(),
  renderClaimedFormat: vi.fn()
}));

const input = employeeActivityInputSchema.parse({
  ...normal,
  activityName: "羽球挑战赛",
  slogan: "一起上场",
  subtitle: "零基础也能参加",
  includeQr: false,
  qrPayload: "",
  qrAssetId: ""
});
const document = posterDocumentSchema.parse({
  ...input,
  schemaVersion: "1.7",
  scene: "employee_activity",
  locale: "zh-CN",
  title: input.activityName,
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

function baseJob(): CampaignGenerationJob {
  const createdAt = "2026-09-08T08:00:00.000Z";
  return {
    id: "8d2345d5-4ea2-4e00-b47c-bbf28c073af0",
    traceId: "trace",
    idempotencyKey: "6ea67aaf-4c6e-46aa-a813-033f7bce322c",
    actionIdempotencyKeys: [],
    userId: "owner",
    input,
    campaignBrief: campaignBriefFromLegacyInput(input, [
      "portrait_1080x1920"
    ]),
    status: "GENERATING_ASSET",
    currentStep: "生成主视觉",
    retryCount: 0,
    copyDraft: {
      document,
      provider: "manual-input",
      model: "none",
      promptVersion: "manual-copy-v1",
      createdAt
    },
    confirmedDocument: confirmedCampaignDocumentFromPoster(
      document,
      "e22d48a5-9a0c-4b42-8537-41053a5d121d"
    ),
    visualDraft: {
      description: brief.confirmedDescription,
      brief,
      provider: "t01-base-description",
      promptVersion: "visual-v1",
      sourceCopyCreatedAt: createdAt,
      createdAt,
      fallback: false
    },
    visualOptions: [],
    artifacts: [],
    versions: [],
    createdAt,
    updatedAt: createdAt
  };
}

describe("T01 visual options worker", () => {
  let currentJob: CampaignGenerationJob;

  beforeEach(() => {
    vi.resetAllMocks();
    currentJob = baseJob();
    vi.mocked(findJob).mockImplementation(async () => currentJob);
    vi.mocked(updateJob).mockImplementation(async (_id, change) => {
      const changed = change(currentJob);
      currentJob = {
        ...changed,
        campaignBrief: changed.campaignBrief ?? currentJob.campaignBrief,
        visualOptions: changed.visualOptions ?? currentJob.visualOptions ?? [],
        artifacts: changed.artifacts ?? currentJob.artifacts
      } as CampaignGenerationJob;
      return currentJob;
    });
    vi.mocked(generateIllustration)
      .mockResolvedValueOnce({
        path: "/tmp/first.png",
        mode: "generated",
        provider: "test-image",
        model: "test-model"
      })
      .mockResolvedValueOnce({
        path: "/tmp/second.png",
        mode: "generated",
        provider: "test-image",
        model: "test-model"
      });
    vi.mocked(renderEmployeeActivity).mockResolvedValue({
      outputPath: "/tmp/final.png",
      readability: {
        passed: true,
        logoVariant: "primary",
        backgroundMode: "input"
      } as never
    });
  });

  it("keeps two generated options and renders the first selected option", async () => {
    await runVisualStage(currentJob.id, document, "第一份描述：蓝色羽毛球高速飞行。");
    const firstOption = currentJob.visualOptions?.[0];
    expect(firstOption?.assetPath).toBe("/tmp/first.png");

    currentJob = {
      ...currentJob,
      status: "GENERATING_ASSET",
      currentStep: "再次生成"
    };
    await runVisualStage(currentJob.id, document, "第二份描述：绿色羽毛球拍面特写。");

    expect(currentJob.visualOptions).toHaveLength(2);
    expect(currentJob.visualOptions?.[1]?.assetPath).toBe("/tmp/second.png");

    currentJob = {
      ...currentJob,
      status: "RENDERING",
      selectedVisualOptionId: firstOption!.id
    };
    await runSelectedVisualStage(currentJob.id, firstOption!.id);

    expect(renderEmployeeActivity).toHaveBeenCalledWith(
      document,
      "/tmp/first.png",
      expect.any(String),
      expect.any(Object)
    );
    expect(currentJob.confirmedVisualOptionId).toBe(firstOption?.id);
    expect(currentJob.versions.at(-1)?.assetPath).toBe("/tmp/first.png");
  });

  it("keeps successful options when a later generation fails", async () => {
    vi.mocked(generateIllustration).mockReset();
    vi.mocked(generateIllustration)
      .mockResolvedValueOnce({
        path: "/tmp/success.png",
        mode: "generated",
        provider: "test-image",
        model: "test-model"
      })
      .mockRejectedValueOnce(new Error("temporary image failure"));

    await runVisualStage(currentJob.id, document, "第一份成功描述。");
    currentJob = {
      ...currentJob,
      status: "GENERATING_ASSET",
      currentStep: "再次生成"
    };
    await runVisualStage(currentJob.id, document, "第二份失败描述。");

    expect(currentJob.visualOptions).toHaveLength(1);
    expect(currentJob.visualOptions?.[0]?.assetPath).toBe("/tmp/success.png");
    expect(currentJob.status).toBe("READY_FOR_VISUAL_REVIEW");
    expect(currentJob.currentStep).toContain("已保留此前方案");
  });
});
