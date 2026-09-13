import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CampaignGenerationJob,
  GenerationJob
} from "@/contracts/job";
import { POST as selectVisualOption } from "@/app/api/jobs/[jobId]/visual-options/select/route";
import { POST as confirmVisualOption } from "@/app/api/jobs/[jobId]/visual-options/confirm/route";
import {
  claimJobAction,
  findJob,
  updateJob
} from "@/server/job-store";
import { runSelectedVisualStage } from "@/worker/run-job";

vi.mock("@/server/auth", () => ({
  requireApiIdentity: async () => ({ userId: "owner" }),
  forbiddenResponse: () => new Response("forbidden", { status: 403 }),
  unauthorizedResponse: () => new Response("unauthorized", { status: 401 })
}));
vi.mock("@/server/job-store", () => ({
  findJob: vi.fn(),
  updateJob: vi.fn(),
  claimJobAction: vi.fn(),
  JobActionError: class extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
    }
  }
}));
vi.mock("@/worker/run-job", () => ({
  runSelectedVisualStage: vi.fn()
}));

const optionId = "a0e2e33e-75ef-49d5-91b4-a46d6a12979e";
const job: CampaignGenerationJob = {
  id: "job",
  traceId: "trace",
  idempotencyKey: "6ea67aaf-4c6e-46aa-a813-033f7bce322c",
  actionIdempotencyKeys: [],
  userId: "owner",
  input: {} as never,
  campaignBrief: {} as never,
  status: "READY_FOR_VISUAL_REVIEW",
  currentStep: "等待选择",
  retryCount: 0,
  copyDraft: { document: {} as never, provider: "test", model: "test", promptVersion: "test", createdAt: "2026-09-08T08:00:00.000Z" },
  visualOptions: [
    {
      id: optionId,
      createdAt: "2026-09-08T08:02:00.000Z",
      description: "羽毛球高速飞行",
      sourceDraftCreatedAt: "2026-09-08T08:01:00.000Z",
      sourceCopyCreatedAt: "2026-09-08T08:00:00.000Z",
      sourceDocumentVersionId: "e22d48a5-9a0c-4b42-8537-41053a5d121d",
      sourceDocument: {} as never,
      promptVersion: "visual-v1",
      brief: {} as never,
      assetPath: "/tmp/first.png",
      assetMode: "generated",
      imageProvider: "test",
      imageModel: "test"
    }
  ],
  artifacts: [],
  versions: [],
  createdAt: "2026-09-08T08:00:00.000Z",
  updatedAt: "2026-09-08T08:00:00.000Z"
};

function applyChange(
  change: (job: CampaignGenerationJob) => GenerationJob
): CampaignGenerationJob {
  return {
    ...change(job),
    campaignBrief: job.campaignBrief,
    artifacts: job.artifacts
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findJob).mockResolvedValue(job);
});

describe("visual option routes", () => {
  it("persists the selected visual option", async () => {
    vi.mocked(updateJob).mockImplementation(async (_id, change) =>
      applyChange(change)
    );

    const response = await selectVisualOption(
      new Request("http://localhost/api/jobs/job/visual-options/select", {
        method: "POST",
        body: JSON.stringify({ optionId })
      }),
      { params: Promise.resolve({ jobId: "job" }) }
    );

    expect(response.status).toBe(200);
    const changed = vi.mocked(updateJob).mock.results[0].value;
    await expect(changed).resolves.toMatchObject({
      selectedVisualOptionId: optionId
    });
  });

  it("only starts final rendering after the selected option is confirmed", async () => {
    const selectedJob = { ...job, selectedVisualOptionId: optionId };
    vi.mocked(findJob).mockResolvedValue(selectedJob);
    vi.mocked(claimJobAction).mockImplementation(
      async (_id, _key, _statuses, change) => ({
        ...change(selectedJob),
        campaignBrief: selectedJob.campaignBrief,
        artifacts: selectedJob.artifacts
      })
    );

    const response = await confirmVisualOption(
      new Request("http://localhost/api/jobs/job/visual-options/confirm", {
        method: "POST",
        body: JSON.stringify({
          optionId,
          idempotencyKey: "211bc262-5c75-475f-89d8-82a6312f4126"
        })
      }),
      { params: Promise.resolve({ jobId: "job" }) }
    );

    expect(response.status).toBe(202);
    const claimed = vi.mocked(claimJobAction).mock.results[0].value;
    await expect(claimed).resolves.toMatchObject({
      status: "RENDERING"
    });
    expect(runSelectedVisualStage).toHaveBeenCalledWith("job", optionId);
  });
});
