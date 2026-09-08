import { beforeEach, describe, expect, it, vi } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import {
  campaignBriefFromLegacyInput,
  confirmedCampaignDocumentFromPoster,
  employeeActivityInputSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import type {
  CampaignGenerationJob,
  GenerationJob
} from "@/contracts/job";
import { POST as confirmVisual } from "@/app/api/jobs/[jobId]/confirm-visual/route";
import { POST as regenerateAsset } from "@/app/api/jobs/[jobId]/regenerate-asset/route";
import {
  claimJobAction,
  findJob
} from "@/server/job-store";
import { runVisualStage } from "@/worker/run-job";
import { createT01BaseVisualDraft } from "@/providers/t01-base-visual";

vi.mock("@/server/auth", () => ({
  requireApiIdentity: async () => ({ userId: "owner" }),
  forbiddenResponse: () => new Response("forbidden", { status: 403 }),
  unauthorizedResponse: () => new Response("unauthorized", { status: 401 })
}));
vi.mock("@/server/job-store", () => ({
  findJob: vi.fn(),
  claimJobAction: vi.fn(),
  JobActionError: class extends Error {
    code = "ACTION_NOT_ALLOWED";
  }
}));
vi.mock("@/worker/run-job", () => ({ runVisualStage: vi.fn() }));

const input = employeeActivityInputSchema.parse({
  ...normal,
  activityName: "羽球挑战赛",
  slogan: "九号员工羽球挑战赛 / BADMINTON",
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
const copyCreatedAt = "2026-09-08T08:00:00.000Z";
const visualDraft = createT01BaseVisualDraft(
  document,
  copyCreatedAt,
  "2026-09-08T08:01:00.000Z"
);

function baseJob(): CampaignGenerationJob {
  return {
    id: "job",
    traceId: "trace",
    idempotencyKey: "6ea67aaf-4c6e-46aa-a813-033f7bce322c",
    actionIdempotencyKeys: [],
    userId: "owner",
    input,
    campaignBrief: campaignBriefFromLegacyInput(input),
    status: "READY_FOR_VISUAL_REVIEW",
    currentStep: "等待确认视觉描述",
    retryCount: 0,
    copyDraft: {
      document,
      provider: "manual-input",
      model: "none",
      promptVersion: "manual-copy-v1",
      createdAt: copyCreatedAt
    },
    confirmedDocument: confirmedCampaignDocumentFromPoster(
      document,
      "e22d48a5-9a0c-4b42-8537-41053a5d121d"
    ),
    visualDraft,
    artifacts: [],
    versions: [],
    createdAt: copyCreatedAt,
    updatedAt: copyCreatedAt
  };
}

function applyJobChange(
  job: CampaignGenerationJob,
  change: (job: CampaignGenerationJob) => GenerationJob
): CampaignGenerationJob {
  const changed = change(job);
  return {
    ...changed,
    campaignBrief: changed.campaignBrief ?? job.campaignBrief,
    artifacts: changed.artifacts ?? job.artifacts
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("visual description routes", () => {
  it("saves the edited description with its copy source before image generation", async () => {
    const job = baseJob();
    vi.mocked(findJob).mockResolvedValue(job);
    vi.mocked(claimJobAction).mockImplementation(async (_id, _key, _statuses, change) =>
      applyJobChange(job, change)
    );
    const editedDescription =
      "主体：羽毛球拍击球瞬间。风格：真实编辑摄影。色彩：蓝白灰。构图：主体位于中右，顶部保持低细节。";

    const response = await confirmVisual(
      new Request("http://localhost/api/jobs/job/confirm-visual", {
        method: "POST",
        body: JSON.stringify({
          sourceDraftCreatedAt: visualDraft.createdAt,
          description: editedDescription,
          idempotencyKey: "6d9a1f04-c018-4a82-b28b-01f4e53cf73e"
        })
      }),
      { params: Promise.resolve({ jobId: "job" }) }
    );

    expect(response.status).toBe(202);
    const claimed = vi.mocked(claimJobAction).mock.results[0].value;
    await expect(claimed).resolves.toMatchObject({
      status: "GENERATING_ASSET",
      confirmedVisual: {
        description: editedDescription,
        sourceDraftCreatedAt: visualDraft.createdAt,
        sourceCopyCreatedAt: copyCreatedAt
      }
    });
    expect(runVisualStage).toHaveBeenCalledWith(
      "job",
      document,
      editedDescription
    );
  });

  it("restores the saved description as unconfirmed when returning to visual editing", async () => {
    const savedDescription =
      "主体：羽毛球器材特写。风格：真实摄影。色彩：蓝白。构图：顶部低细节。";
    const job: CampaignGenerationJob = {
      ...baseJob(),
      status: "READY_FOR_REVIEW",
      confirmedVisual: {
        description: savedDescription,
        sourceDraftCreatedAt: visualDraft.createdAt,
        sourceCopyCreatedAt: copyCreatedAt,
        createdAt: "2026-09-08T08:02:00.000Z"
      },
      versions: [
        {
          id: "version",
          createdAt: copyCreatedAt,
          posterDocument: document,
          outputFormat: "portrait_1080x1920",
          templateVersion: "t01",
          promptVersion: "manual-copy-v1",
          illustrationPromptVersion: "visual-v1",
          modelInfo: {
            copyProvider: "manual-input",
            copyModel: "none",
            compilerProvider: "confirmed-visual",
            imageProvider: "demo-image",
            imageModel: "demo-image"
          },
          assetMode: "fallback",
          assetPath: "asset.png",
          outputPath: "poster.png",
          validation: { passed: true, messages: [] }
        }
      ]
    };
    vi.mocked(findJob).mockResolvedValue(job);
    vi.mocked(claimJobAction).mockImplementation(async (_id, _key, _statuses, change) =>
      applyJobChange(job, change)
    );

    const response = await regenerateAsset(
      new Request("http://localhost/api/jobs/job/regenerate-asset", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: "6c745f24-817e-440d-bc26-ae1f44a017cb"
        })
      }),
      { params: Promise.resolve({ jobId: "job" }) }
    );

    expect(response.status).toBe(202);
    const claimed = vi.mocked(claimJobAction).mock.results[0].value;
    await expect(claimed).resolves.toMatchObject({
      status: "READY_FOR_VISUAL_REVIEW",
      visualDraft: { description: savedDescription },
      confirmedVisual: undefined
    });
  });
});
