import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/copy-suggestions/route";
import { requireApiIdentity } from "@/server/auth";
import { requestJson } from "@/providers/provider-error";

vi.mock("@/server/auth", () => ({ requireApiIdentity: vi.fn(), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/env", () => ({ configured: { copy: true }, serverEnv: { LLM_BASE_URL: "https://example.test", LLM_MODEL: "test", LLM_API_KEY: "test" } }));
vi.mock("@/providers/provider-error", async (original) => ({ ...await original<typeof import("@/providers/provider-error")>(), requestJson: vi.fn() }));
const request = (title: string) => new Request("http://localhost/api/copy-suggestions", { method: "POST", body: JSON.stringify({ title }) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireApiIdentity).mockResolvedValue({ userId: "owner", displayName: "Owner", provider: "local" });
});
it("generates from only a title, without event facts or a job", async () => {
  const result = { slogan: "九号员工羽球赛 / BADMINTON", subtitle: "一起上场" };
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify(result) } }] });
  const response = await POST(request("羽毛球赛"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  const body = JSON.parse(vi.mocked(requestJson).mock.calls[0][1].body as string);
  expect(JSON.parse(body.messages[1].content)).toEqual({ title: "羽毛球赛" });
});
it("rejects missing titles before calling the model", async () => {
  expect((await POST(request(" "))).status).toBe(400);
  expect(requestJson).not.toHaveBeenCalled();
});
it("requires authentication", async () => {
  vi.mocked(requireApiIdentity).mockResolvedValue(undefined);
  expect((await POST(request("羽毛球赛"))).status).toBe(401);
  expect(requestJson).not.toHaveBeenCalled();
});
it("rejects invalid model output without returning partial suggestions", async () => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: '{"slogan":"","subtitle":"test"}' } }] });
  expect((await POST(request("羽毛球赛"))).status).toBe(502);
});
