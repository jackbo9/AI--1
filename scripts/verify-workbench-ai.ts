import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

async function main() {
if (process.env.ALLOW_PAID_MODEL_PROBE !== "1") throw new Error("Requires explicit ALLOW_PAID_MODEL_PROBE=1");
const base = "http://127.0.0.1:3214";
const directory = path.join(process.cwd(), "test-results", `workbench-ai-${Date.now()}`);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const results: Record<string, unknown> = { directory, started: new Date().toISOString(), errors: [] };
const pageErrors: string[] = [];
page.on("pageerror", error => pageErrors.push(error.message));
const save = async () => writeFile(path.join(directory, "report.json"), JSON.stringify({ ...results, pageErrors }, null, 2));
async function jobFor(p: Page) {
  const id = new URL(p.url()).searchParams.get("job");
  if (!id) throw new Error("No real job id in page URL");
  const response = await p.request.get(`${base}/api/jobs/${id}`);
  if (!response.ok()) throw new Error(`Read job failed: ${response.status()}`);
  return response.json();
}
async function waitJob(done: (job: Awaited<ReturnType<typeof jobFor>>) => boolean, seconds = 600) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const job = await jobFor(page);
    if (done(job)) return job;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("Job timed out; retained job can be resumed without resubmitting");
}
async function downloads(url: string, prefix: string) {
  const checked = [];
  for (const format of ["png", "jpg"]) {
    const response = await page.request.get(base + url + (format === "jpg" ? "?format=jpg" : ""));
    if (!response.ok()) throw new Error(`${prefix} ${format} download failed: ${response.status()}`);
    const bytes = await response.body();
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== 1080 || metadata.height !== 1920 || metadata.format !== (format === "jpg" ? "jpeg" : "png")) throw new Error("Unexpected image format or dimensions");
    await writeFile(path.join(directory, `${prefix}.${format}`), bytes);
    checked.push({ format, width: metadata.width, height: metadata.height, bytes: bytes.length });
  }
  return checked;
}
try {
  await page.goto(base);
  results.extractionCases = [];
  for (const brief of ["本周五准备了喜茶奶茶和乐乐茶面包作为下午茶", "下午茶测试样例：和路雪冰淇淋与奶茶，无真实活动信息。", "请制作一张下午茶海报，具体食品待定。测试样例，无真实活动信息。"]) {
    const response = await page.request.post(base + "/api/tea/extract", { data: { brief }, timeout: 110000 });
    const body = await response.json();
    (results.extractionCases as unknown[]).push({ brief, status: response.status(), body });
    const expectsFood = !brief.includes("具体食品待定");
    if (!response.ok() || Boolean(body.fields?.food) !== expectsFood) {
      (results.errors as string[]).push(`extraction: unexpected food result for ${brief}`);
    }
    await save();
    console.log(JSON.stringify({ phase: "real-extraction", brief, status: response.status(), food: body.fields?.food, missing: body.missing, error: body.error }));
  }
  try {
    await page.goto(`${base}/?scene=employee-afternoon-tea`);
    await page.getByLabel("这次准备了什么下午茶？").fill("本周五准备了喜茶奶茶和乐乐茶面包作为下午茶");
    const extraction = page.waitForResponse(r => r.url().endsWith("/api/tea/extract"), { timeout: 110000 });
    await page.getByRole("button", { name: "AI 整理内容", exact: true }).click();
    const extracted = await (await extraction).json();
    results.tea = { extracted };
    await save();
    if (!extracted.fields?.food) throw new Error(`Food extraction failed: ${JSON.stringify(extracted)}`);
    await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
    await page.waitForURL(/job=/);
    const initial = await jobFor(page);
    results.tea = { extracted, jobId: initial.id, url: page.url() };
    await save();
    console.log(JSON.stringify({ phase: "tea-images-started", jobId: initial.id }));
    const generated = await waitJob(j => j.options.length === 2 && j.options.every((o: { status: string }) => ["READY", "FAILED"].includes(o.status)));
    results.tea = { ...(results.tea as object), options: generated.options };
    await save();
    if (generated.options.some((o: { status: string }) => o.status !== "READY")) throw new Error("Tea image option failed; see report");
    await page.locator(".ead-option-card").first().click();
    await page.screenshot({ path: path.join(directory, "tea-options.png") });
    await page.getByRole("button", { name: "使用所选方案并排版 →" }).click();
    const rendered = await waitJob(j => j.status !== "RENDERING" && (j.outputs.length > 0 || j.error), 180);
    results.tea = { ...(results.tea as object), output: rendered.outputs.at(-1), error: rendered.error };
    await save();
    const output = rendered.outputs.at(-1);
    if (!output?.previewUrl || !output.exportAllowed) throw new Error("Tea render/export blocked; see report");
    results.tea = { ...(results.tea as object), downloads: await downloads(output.previewUrl, "tea-poster") };
    await page.reload();
    await page.getByRole("link", { name: "下载 PNG", exact: true }).waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(directory, "tea-result.png") });
    results.tea = { ...(results.tea as object), restored: true, passed: true };
    console.log("Tea real generation, render, PNG/JPG and restore passed");
  } catch (error) { (results.errors as string[]).push(`tea: ${String(error)}`); console.log(`TEA FAILURE: ${String(error)}`); }
  await save();
  try {
    await page.goto(base);
    await page.getByLabel("一级大标题").fill("羽球测试赛");
    await page.getByLabel("宣言标题").fill("九号员工羽球赛 / BADMINTON");
    await page.getByLabel("副标题", { exact: false }).fill("一起上场，热爱不设限");
    await page.getByLabel("01 比赛日期").fill("2026-09-18");
    await page.getByLabel("02 比赛地点").fill("测试体育馆");
    await page.getByLabel("03 参与对象").fill("测试参与者");
    await page.getByLabel("04 赛事规则").fill("测试用例：三局两胜，无真实活动信息");
    await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
    await page.getByRole("button", { name: "生成主视觉描述", exact: true }).click();
    await page.getByLabel("主视觉描述", { exact: true }).waitFor({ timeout: 120000 });
    const saved = await page.getByLabel("主视觉描述", { exact: true }).inputValue();
    results.sports = { jobId: (await jobFor(page)).id, url: page.url(), saved };
    await save();
    await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
    console.log(JSON.stringify({ phase: "sports-images-started", ...results.sports as object }));
    const generated = await waitJob(j => j.status !== "GENERATING_ASSET" && (j.visualOptions?.length >= 2 || j.error || j.visualBatches?.some((b: { directions: { status: string }[] }) => b.directions.some(d => d.status === "FAILED"))));
    results.sports = { ...(results.sports as object), options: generated.visualOptions, batches: generated.visualBatches };
    await save();
    if (generated.visualOptions?.length !== 2) throw new Error("Sports initial pair failed; see report");
    await page.locator(".ead-option-card").first().click();
    await page.getByRole("button", { name: "使用所选方案并排版 →" }).click();
    const rendered = await waitJob(j => j.status === "READY_FOR_REVIEW" || j.status.startsWith("FAILED"), 180);
    results.sports = { ...(results.sports as object), validation: rendered.versions.at(-1)?.validation };
    await save();
    if (rendered.status !== "READY_FOR_REVIEW") throw new Error("Sports rendering failed");
    results.sports = { ...(results.sports as object), downloads: await downloads(rendered.previewUrl, "sports-poster") };
    await page.getByRole("button", { name: "只换主视觉", exact: true }).click();
    const description = page.getByLabel("主视觉描述", { exact: true });
    await description.waitFor({ timeout: 30000 });
    if (await description.inputValue() !== saved) throw new Error("Saved description changed after return");
    const regenerate = page.getByRole("button", { name: "重新生成两张主视觉", exact: true });
    if (!await regenerate.isEnabled()) throw new Error("Regeneration disabled after return");
    await page.screenshot({ path: path.join(directory, "sports-return.png") });
    const before = await jobFor(page);
    if (before.visualOptions.length !== 2) throw new Error("Return unexpectedly changed images");
    await regenerate.click();
    console.log("Sports returned with saved description; regenerating real second pair");
    const regenerated = await waitJob(j => j.status !== "GENERATING_ASSET" && (j.visualOptions?.length >= 4 || j.error || j.visualBatches?.at(-1)?.directions.some((d: { status: string }) => d.status === "FAILED")));
    results.sports = { ...(results.sports as object), regeneratedOptions: regenerated.visualOptions, regeneratedBatches: regenerated.visualBatches };
    await save();
    if (regenerated.visualOptions.length !== 4) throw new Error("Sports second pair failed; see report");
    await page.screenshot({ path: path.join(directory, "sports-regenerated.png") });
    results.sports = { ...(results.sports as object), passed: true };
    console.log("Sports real AI description, initial pair, rendering, downloads and second pair passed");
  } catch (error) { (results.errors as string[]).push(`sports: ${String(error)}`); console.log(`SPORTS FAILURE: ${String(error)}`); }
} finally {
  results.finished = new Date().toISOString();
  await save();
  await browser.close();
  console.log(JSON.stringify({ directory, errors: results.errors, pageErrors }));
  if ((results.errors as string[]).length || pageErrors.length) process.exitCode = 1;
}
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
