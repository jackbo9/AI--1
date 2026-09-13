import { beforeEach, expect, it, vi } from "vitest";
import { extractTea } from "@/providers/tea-provider";
import { requestJson } from "@/providers/provider-error";
vi.mock("@/lib/env", () => ({ configured: { copy: true }, serverEnv: { LLM_BASE_URL: "http://example.invalid", LLM_MODEL: "test", LLM_API_KEY: "test" } }));
vi.mock("@/providers/provider-error", async original => ({ ...await original<typeof import("@/providers/provider-error")>(), requestJson: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const output = { food: "无花果", title: "午后鲜享", subtitle: "清甜好时光", visualPrompt: "食品切面近景", time: "", place: "" };
it("does not accept foods or pickup facts invented by the text model", async () => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...output, food: "蛋糕", time: "15:00", place: "会议室" }) } }] });
  const result = await extractTea("无花果");
  expect(result.fields.food).toBe(""); expect(result.fields.time).toBe(""); expect(result.fields.place).toBe("");
  expect(result.missing).toEqual(["food", "time", "place"]);
});
it("preserves explicit source facts and returns a ready-to-edit visual description", async () => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify(output) } }] });
  const result = await extractTea("无花果");
  expect(result.fields.food).toBe("无花果"); expect(result.fields.visualPrompt).toBe(output.visualPrompt);
});
it("rejects overlong or malformed model output rather than claiming a successful fallback", async () => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...output, title: "一二三四五六七八" }) } }] });
  await expect(extractTea("无花果")).rejects.toThrow("不符合要求");
});
