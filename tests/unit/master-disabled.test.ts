import { describe, it, expect, vi } from "vitest";
import { GET, POST } from "@/app/api/jobs/[jobId]/master-protection/route";
import { requireApiIdentity } from "@/server/auth";
import { findJob } from "@/server/job-store";
vi.mock("@/server/auth", () => ({ requireApiIdentity: vi.fn(), unauthorizedResponse: () => new Response(null, { status: 401 }), forbiddenResponse: () => new Response(null, { status: 403 }) }));
vi.mock("@/server/job-store", () => ({ findJob: vi.fn() }));
describe("retired mother protection endpoint", () => {
  it("retains authentication and ownership checks", async () => {
    const request = new Request("http://localhost/api/jobs/job/master-protection");
    const context = { params: Promise.resolve({ jobId: "job" }) };
    vi.mocked(requireApiIdentity).mockResolvedValue(undefined as never);
    expect((await POST(request, context)).status).toBe(401);
    vi.mocked(requireApiIdentity).mockResolvedValue({ userId: "owner" } as never);
    vi.mocked(findJob).mockResolvedValue({ userId: "other" } as never);
    expect((await GET(request, context)).status).toBe(403);
    vi.mocked(findJob).mockResolvedValue({ userId: "owner" } as never);
    for (const handler of [GET, POST]) {
      const result = await handler(request, context);
      expect(result.status).toBe(410);
      expect((await result.json()).error.code).toBe("MASTER_ADAPTATION_DISABLED");
    }
  });
});
