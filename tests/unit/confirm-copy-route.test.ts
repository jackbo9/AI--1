import { beforeEach, expect, it, vi } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import { employeeActivityInputSchema, posterDocumentSchema } from "@/contracts/poster";
import { POST } from "@/app/api/jobs/[jobId]/confirm-copy/route";
import { findJob, claimJobAction } from "@/server/job-store";
import { preflightEmployeeActivity } from "@/templates/employee-activity";

vi.mock("@/server/auth", () => ({ requireApiIdentity: async () => ({ userId: "owner" }) }));
vi.mock("@/server/job-store", () => ({ findJob: vi.fn(), claimJobAction: vi.fn(), JobActionError: class extends Error {} }));
vi.mock("@/templates/employee-activity", () => ({ preflightEmployeeActivity: vi.fn(), PosterRenderError: class extends Error {} }));
vi.mock("@/server/qr-asset-store", () => ({ readOwnedQrAssetDataUri: vi.fn(), QrAssetError: class extends Error {} }));

const input = employeeActivityInputSchema.parse({ ...normal, includeQr: false, qrPayload: "", qrAssetId: "", deadline: "9月16日" });
const document = posterDocumentSchema.parse({ ...input, schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN", title: input.activityName, subtitle: "一起参加", summary: "说明", immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true } });
const request = () => new Request("http://localhost/api/jobs/test/confirm-copy", { method: "POST", body: JSON.stringify({ idempotencyKey: "ab52c7a3-420c-4eee-9a41-5dce13f3a835", content: { ...document, summary: "活动说明".repeat(20), deadline: undefined } }) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findJob).mockResolvedValue({ userId: "owner", input, status: "READY_FOR_COPY_REVIEW", copyDraft: { document } } as Awaited<ReturnType<typeof findJob>>);
});
it("confirms the short subtitle and retains the longer supplement separately", async () => {
  const response = await POST(request(), { params: Promise.resolve({ jobId: "test" }) });
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ status: "READY_FOR_VISUAL_INPUT" });
  expect(preflightEmployeeActivity).toHaveBeenCalledWith(expect.objectContaining({ subtitle: "一起参加", summary: "活动说明".repeat(20), deadline: "9月16日" }), { qrDataUri: undefined });
  expect(claimJobAction).toHaveBeenCalledOnce();
});
it("returns a JSON error without committing when the renderer fails unexpectedly", async () => {
  vi.mocked(preflightEmployeeActivity).mockRejectedValue(new Error("private path"));
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const response = await POST(request(), { params: Promise.resolve({ jobId: "test" }) });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "COPY_CONFIRM_FAILED", message: "文案确认暂未完成，已保留输入，请重试" } });
    expect(claimJobAction).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
