import { beforeEach, expect, it, vi } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import { POST } from "@/app/api/jobs/route";
import { createJob, findByKey } from "@/server/job-store";
import { runCopyStage } from "@/worker/run-job";
import { campaignBriefFromLegacyInput } from "@/contracts/poster";

vi.mock("@/server/auth", () => ({
  requireApiIdentity: async () => ({ userId: "owner" }),
  unauthorizedResponse: () => new Response("unauthorized", { status: 401 })
}));
vi.mock("@/server/job-store", () => ({
  createJob: vi.fn(),
  findByKey: vi.fn()
}));
vi.mock("@/worker/run-job", () => ({ runCopyStage: vi.fn() }));
vi.mock("@/templates/employee-activity", () => ({
  preflightEmployeeActivity: vi.fn(),
  PosterRenderError: class extends Error {}
}));
vi.mock("@/server/qr-asset-store", () => ({
  readOwnedQrAssetDataUri: vi.fn(),
  QrAssetError: class extends Error {}
}));

beforeEach(() => {
  vi.resetAllMocks();
});

it("starts copy generation once and reuses a repeated submission", async () => {
  vi.mocked(createJob).mockImplementation(async (job) => ({
    ...job,
    campaignBrief: job.campaignBrief ?? campaignBriefFromLegacyInput(job.input),
    artifacts: job.artifacts ?? []
  }));
  const request = () => new Request("http://localhost/api/jobs", {
    method: "POST",
    body: JSON.stringify({
      input: { ...normal, activityName: "羽毛球赛" },
      idempotencyKey: "ab52c7a3-420c-4eee-9a41-5dce13f3a835"
    })
  });

  const first = await POST(request());
  const created = await vi.mocked(createJob).mock.results[0].value;
  expect(first.status).toBe(202);
  await expect(first.json()).resolves.toEqual({ jobId: created.id, status: "QUEUED" });
  expect(runCopyStage).toHaveBeenCalledExactlyOnceWith(created.id);

  vi.mocked(findByKey).mockResolvedValue(created);
  const repeated = await POST(request());
  expect(repeated.status).toBe(202);
  await expect(repeated.json()).resolves.toEqual({ jobId: created.id, status: "QUEUED", reused: true });
  expect(createJob).toHaveBeenCalledTimes(1);
  expect(runCopyStage).toHaveBeenCalledTimes(1);
});

it("defers long-title capacity to the rendered T01 template", async () => {
  vi.mocked(createJob).mockImplementation(async (job) => ({
    ...job,
    campaignBrief: job.campaignBrief ?? campaignBriefFromLegacyInput(job.input),
    artifacts: job.artifacts ?? []
  }));
  const request = new Request("http://localhost/api/jobs", {
    method: "POST",
    body: JSON.stringify({
      input: {
        ...normal,
        activityName: "这是一条超过四十个字符的活动主题用于验证提交前的容量拦截不会调用文案模型并且不会创建任务"
      },
      idempotencyKey: "ab52c7a3-420c-4eee-9a41-5dce13f3a835"
    })
  });

  const response = await POST(request);

  expect(response.status).toBe(202);
  expect(createJob).toHaveBeenCalledOnce();
  expect(runCopyStage).toHaveBeenCalledOnce();
});

it("confirms manually entered copy without starting the copy model", async () => {
  vi.mocked(createJob).mockImplementation(async (job) => ({
    ...job,
    campaignBrief: job.campaignBrief ?? campaignBriefFromLegacyInput(job.input),
    artifacts: job.artifacts ?? []
  }));
  const response = await POST(new Request("http://localhost/api/jobs", {
    method: "POST",
    body: JSON.stringify({
      input: { ...normal, activityName: "羽毛球赛", slogan: "一起上场", subtitle: "现场自由组队" },
      idempotencyKey: "c262b214-3ff2-4cb6-9358-83088df0f9a5",
      skipCopy: true
    })
  }));

  expect(response.status).toBe(202);
  await expect(response.json()).resolves.toMatchObject({ status: "READY_FOR_VISUAL_REVIEW" });
  const candidate = vi.mocked(createJob).mock.calls[0]?.[0];
  expect(candidate?.copyDraft?.document).toMatchObject({
    title: "羽毛球赛",
    slogan: "一起上场",
    subtitle: "现场自由组队"
  });
  expect(candidate?.confirmedDocument).toBeDefined();
  expect(candidate?.visualDraft?.description).toContain("主体：");
  expect(candidate?.visualDraft?.description).toContain("风格：");
  expect(candidate?.visualDraft?.description).toContain("色彩：");
  expect(candidate?.visualDraft?.description).toContain("顶部品牌标识与标题区域");
  expect(runCopyStage).not.toHaveBeenCalled();
});
