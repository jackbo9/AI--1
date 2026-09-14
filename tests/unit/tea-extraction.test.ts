import { beforeEach, expect, it, vi } from "vitest";
import { extractTea } from "@/providers/tea-provider";
import { requestJson } from "@/providers/provider-error";
import { teaFieldsSchema } from "@/contracts/tea";
vi.mock("@/lib/env", () => ({ configured: { copy: true }, serverEnv: { LLM_BASE_URL: "http://example.invalid", LLM_MODEL: "test", LLM_API_KEY: "test" } }));
vi.mock("@/providers/provider-error", async original => ({ ...await original<typeof import("@/providers/provider-error")>(), requestJson: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const output = { food: "无花果", title: "午后鲜享", subtitle: "清甜好时光", visualPrompt: "食品切面近景", time: "", place: "" };
it.each(["喜茶奶茶、乐乐茶面包", "喜茶奶茶，乐乐茶面包", "喜茶奶茶, 乐乐茶面包", "喜茶奶茶以及乐乐茶面包", "喜茶奶茶 + 乐乐茶面包"])("accepts source-backed multiple foods despite list formatting: %s", async food => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...output, food }) } }] });
  const result = await extractTea("本周五准备了喜茶奶茶和乐乐茶面包作为下午茶");
  expect(result.fields.food).toBe("喜茶奶茶、乐乐茶面包");
  expect(result.missing).not.toContain("food");
  expect(teaFieldsSchema.safeParse(result.fields).success).toBe(true);
});
it.each([
  ["本周五准备喜茶奶茶和乐乐茶面包", "喜茶奶茶、蛋糕"],
  ["本周五一起享用下午茶", ""],
  ["本周五一起享用下午茶", "奶茶、面包"],
  ["奶茶和面包", "喜茶奶茶、面包"]
])("keeps missing or invented foods blocked: %s / %s", async (brief, food) => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...output, food }) } }] });
  const result = await extractTea(brief);
  expect(result.fields.food).toBe("");
  expect(result.missing).toContain("food");
  expect(teaFieldsSchema.safeParse(result.fields).success).toBe(false);
});
it("preserves exact names containing conjunctions and pickup facts", async () => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...output, food: "和路雪冰淇淋", time: "周五", place: "茶水间" }) } }] });
  const result = await extractTea("周五在茶水间准备和路雪冰淇淋");
  expect(result.fields).toMatchObject({ food: "和路雪冰淇淋", time: "周五", place: "茶水间" });
});
it.each(["和路雪冰淇淋、奶茶", "和路雪冰淇淋和奶茶"])("preserves conjunctions inside a food brand in lists: %s", async food => {
  vi.mocked(requestJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...output, food }) } }] });
  expect((await extractTea("准备了和路雪冰淇淋与奶茶")).fields.food).toBe("和路雪冰淇淋、奶茶");
});
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
