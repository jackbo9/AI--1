import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/jobs/[jobId]/route";
import { requireApiIdentity } from "@/server/auth";
import { deleteOwnedWork } from "@/server/job-store";

vi.mock("@/server/auth", () => ({
  requireApiIdentity: vi.fn(),
  unauthorizedResponse: () => new Response("", { status: 401 }),
  forbiddenResponse: () => new Response("", { status: 403 })
}));
vi.mock("@/server/job-store", () => ({
  deleteOwnedWork: vi.fn(), findJob: vi.fn(), findTeaJob: vi.fn()
}));

const context = { params: Promise.resolve({ jobId: "11111111-1111-4111-8111-111111111111" }) };

describe("DELETE /api/jobs/:jobId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireApiIdentity).mockResolvedValue({ userId: "owner" } as Awaited<ReturnType<typeof requireApiIdentity>>);
  });
  it("deletes only through the current owner scope", async () => {
    vi.mocked(deleteOwnedWork).mockResolvedValue(true);
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), context);
    expect(response.status).toBe(204);
    expect(deleteOwnedWork).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "owner");
  });
  it("does not reveal missing or foreign work", async () => {
    vi.mocked(deleteOwnedWork).mockResolvedValue(false);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(404);
  });
  it("requires authentication", async () => {
    vi.mocked(requireApiIdentity).mockResolvedValue(undefined);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(401);
    expect(deleteOwnedWork).not.toHaveBeenCalled();
  });
});
