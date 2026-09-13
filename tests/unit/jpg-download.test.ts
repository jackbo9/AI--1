import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { GET } from "@/app/api/files/[...path]/route";
import { requireApiIdentity } from "@/server/auth";
import { findJob } from "@/server/job-store";
import { readFile } from "node:fs/promises";

vi.mock("@/server/auth", () => ({
  requireApiIdentity: vi.fn(), unauthorizedResponse: () => new Response("", { status: 401 }),
  forbiddenResponse: () => new Response("", { status: 403 })
}));
vi.mock("@/server/job-store", () => ({ findJob: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
const filename = "11111111-1111-4111-8111-111111111111-output.png";
const context = { params: Promise.resolve({ path: [filename] }) };
const job = () => ({ userId: "owner", artifacts: [{ status: "READY", validation: { passed: true }, outputPath: filename }], versions: [], visualOptions: [] });
function stored(value: ReturnType<typeof job>) { vi.mocked(findJob).mockResolvedValue(value as unknown as Awaited<ReturnType<typeof findJob>>); }

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(requireApiIdentity).mockResolvedValue({ userId: "owner" } as Awaited<ReturnType<typeof requireApiIdentity>>);
  stored(job());
  const png = await sharp({ create: { width: 32, height: 48, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  vi.mocked(readFile).mockResolvedValue(png);
});

describe("authenticated JPG export", () => {
  it("keeps dimensions, uses a white background and leaves PNG unchanged", async () => {
    const response = await GET(new Request("http://localhost/api/files/" + filename + "?format=jpg"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Content-Disposition")).toContain(".jpg");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 32, height: 48, format: "jpeg" });
    const pixel = await sharp(bytes).raw().toBuffer();
    expect([...pixel.subarray(0, 3)]).toEqual([255, 255, 255]);
    const png = await GET(new Request("http://localhost/api/files/" + filename), context);
    expect(png.headers.get("Content-Type")).toBe("image/png");
  });
  it("rejects anonymous and other-user access before reading bytes", async () => {
    vi.mocked(requireApiIdentity).mockResolvedValue(undefined);
    expect((await GET(new Request("http://localhost/?format=jpg"), context)).status).toBe(401);
    vi.mocked(requireApiIdentity).mockResolvedValue({ userId: "other" } as Awaited<ReturnType<typeof requireApiIdentity>>);
    expect((await GET(new Request("http://localhost/?format=jpg"), context)).status).toBe(403);
    expect(readFile).not.toHaveBeenCalled();
  });
  it("does not convert forbidden outputs or raw visual options", async () => {
    const blocked = job();
    blocked.artifacts[0].validation.passed = false;
    stored(blocked);
    expect((await GET(new Request("http://localhost/?format=jpg"), context)).status).toBe(404);
    vi.mocked(findJob).mockResolvedValue({ userId: "owner", artifacts: [], versions: [], visualOptions: [{ assetPath: filename }] } as unknown as Awaited<ReturnType<typeof findJob>>);
    expect((await GET(new Request("http://localhost/?format=jpg"), context)).status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });
  it("returns a retryable conversion message and still serves the original", async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from("invalid image"));
    const failed = await GET(new Request("http://localhost/?format=jpg"), context);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ error: { code: "JPG_CONVERSION_FAILED" } });
    expect((await GET(new Request("http://localhost/"), context)).status).toBe(200);
  });
});
