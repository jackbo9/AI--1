import { beforeEach, expect, it, vi } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import { POST } from "@/app/api/jobs/route";
import { createJob, findByKey } from "@/server/job-store";
import { runJob } from "@/worker/run-job";

vi.mock("@/server/auth", () => ({
  requireApiIdentity: async () => ({ userId: "owner" }),
  unauthorizedResponse: () => new Response("unauthorized", { status: 401 })
}));
vi.mock("@/server/job-store", () => ({
  createJob: vi.fn(),
  findByKey: vi.fn()
}));
vi.mock("@/worker/run-job", () => ({ runJob: vi.fn() }));
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

it("rejects a title beyond the T01 one-line capacity before copy generation", async () => {
  const request = new Request("http://localhost/api/jobs", {
    method: "POST",
    body: JSON.stringify({
      input: {
        ...normal,
        activityName: "羽毛球秋日挑战赛"
      },
      idempotencyKey: "ab52c7a3-420c-4eee-9a41-5dce13f3a835"
    })
  });

  const response = await POST(request);

  expect(response.status).toBe(422);
  await expect(response.json()).resolves.toEqual({
    error: {
      code: "T01_TITLE_TOO_LONG",
      message: "T01 竖版主题最多 5 个字，请在生成文案前精简主题"
    }
  });
  expect(findByKey).not.toHaveBeenCalled();
  expect(createJob).not.toHaveBeenCalled();
  expect(runJob).not.toHaveBeenCalled();
});
