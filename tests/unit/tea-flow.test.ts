import { afterAll, beforeAll, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { teaFieldsSchema, teaScene, recoverTeaJob, sameTeaFields, type TeaJob } from "@/contracts/tea";
import { teaImagePrompt } from "@/providers/tea-provider";
import { teaMarkup } from "@/templates/tea-layout";
import normal from "../fixtures/employee-activity.normal.json";

vi.mock("@/worker/tea-job", () => ({ runTeaVisuals: vi.fn(), runTeaRender: vi.fn() }));
let root: string;
let store: typeof import("@/server/job-store");
let api: typeof import("@/server/tea-api");
const fields = { brief: "无花果，周五在茶水间领取", food: "无花果", title: "午后鲜享", subtitle: "清甜好时光", visualPrompt: "新鲜无花果切面，自然色", time: "周五", place: "茶水间" };
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "tea-store-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  store = await import("@/server/job-store");
  api = await import("@/server/tea-api");
});
afterAll(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });

it("rejects missing food, long titles and multiline subtitles; excludes pickup facts from template", () => {
  expect(sameTeaFields(fields, { ...fields, brief: ` ${fields.brief} ` })).toBe(true);
  expect(sameTeaFields(fields, Object.fromEntries(Object.entries(fields).reverse()) as typeof fields)).toBe(true);
  expect(sameTeaFields(fields, { ...fields, title: "新的标题" })).toBe(false);
  for (const invalid of [{ food: "" }, { title: "一二三四五六七八" }, { subtitle: "甲\n乙" }]) expect(teaFieldsSchema.safeParse({ ...fields, ...invalid }).success).toBe(false);
  const html = teaMarkup({ title: "<script>", subtitle: fields.subtitle }, undefined, "/brand.svg");
  expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("茶水间"); expect(html).not.toContain("周五");
  const prompt = teaImagePrompt(fields, fields.visualPrompt, "近景");
  expect(prompt).toContain("底部锚定"); expect(prompt).not.toContain("体育"); expect(prompt).not.toContain("茶水间");
});

it("keeps tea and historical activity records across interleaved writes", async () => {
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await store.createJob({ id, traceId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), actionIdempotencyKeys: [], userId: "owner", input: normal as never, status: "QUEUED", currentStep: "test", retryCount: 0, versions: [], createdAt: now, updatedAt: now });
  const body = { scene: teaScene, fields, idempotencyKey: crypto.randomUUID() };
  const tea = await (await api.createTeaResponse(body, "owner")).json() as TeaJob;
  expect((await (await api.createTeaResponse(body, "owner")).json()).id).toBe(tea.id);
  await store.updateJob(id, job => ({ ...job, currentStep: "retained" }));
  await store.updateTeaJob(tea.id, job => ({ ...job, error: "test" }));
  expect((await store.findJob(id))?.currentStep).toBe("retained");
  expect((await store.findTeaJob(tea.id))?.fields.food).toBe("无花果");
  expect(await store.findJob(tea.id)).toBeUndefined();
  expect(JSON.parse(await readFile(path.join(root, "data/jobs.json"), "utf8"))).toHaveLength(2);
});

it("claims a pair once, rejects stale/foreign actions and retries only the failed direction", async () => {
  const tea = await (await api.createTeaResponse({ scene: teaScene, fields, idempotencyKey: crypto.randomUUID() }, "owner")).json() as TeaJob;
  const key = crypto.randomUUID();
  const request = (extra = {}) => new Request("http://localhost", { method: "POST", body: JSON.stringify({ idempotencyKey: key, sourceVersionId: tea.sourceVersionId, description: fields.visualPrompt, ...extra }) });
  expect((await api.dispatchTeaAction(request(), tea.id, "other", "generate"))?.status).toBe(403);
  expect((await api.dispatchTeaAction(request({ sourceVersionId: crypto.randomUUID() }), tea.id, "owner", "generate"))?.status).toBe(409);
  await api.dispatchTeaAction(request(), tea.id, "owner", "generate");
  await api.dispatchTeaAction(request(), tea.id, "owner", "generate");
  let stored = (await store.findTeaJob(tea.id))!;
  expect(stored.options).toHaveLength(2); expect(stored.selectedVisualOptionId).toBeUndefined();
  const worker = await import("@/worker/tea-job");
  expect(worker.runTeaVisuals).toHaveBeenCalledTimes(1);
  await store.updateTeaJob(tea.id, j => ({ ...j, status: "READY_FOR_VISUAL_REVIEW", options: j.options.map((o, index) => ({ ...o, status: index ? "FAILED" : "READY", assetPath: index ? undefined : "/private/original.png" })) }));
  await api.dispatchTeaAction(request({ idempotencyKey: crypto.randomUUID(), optionId: stored.options[1].id }), tea.id, "owner", "retry");
  stored = (await store.findTeaJob(tea.id))!;
  expect(stored.options[0].assetPath).toBe("/private/original.png");
  expect(worker.runTeaVisuals).toHaveBeenLastCalledWith(tea.id, [stored.options[1].id]);
  const recovered = recoverTeaJob(stored);
  expect(recovered.options[0].status).toBe("READY"); expect(recovered.options[1].status).toBe("FAILED");
  expect(recovered.status).toBe("READY_FOR_VISUAL_REVIEW");
  expect(JSON.stringify(api.publicTeaJob(stored))).not.toContain("/private/");
});
