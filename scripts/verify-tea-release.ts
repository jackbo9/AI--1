import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

async function main() {
if (process.env.ALLOW_PAID_MODEL_PROBE !== "1") throw new Error("真实验收需要 ALLOW_PAID_MODEL_PROBE=1；不输出任何模型凭据。");
const base = "http://127.0.0.1:3214";
const directory = path.join(process.cwd(), "test-results/tea-release");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const failures: string[] = [];
  page.on("pageerror", e => failures.push(e.message));
  const existing = process.argv[2];
  await page.goto(`${base}/?scene=employee-afternoon-tea${existing ? `&job=${existing}` : ""}`);
  if (existing) {
    await page.waitForFunction(() => Boolean(document.querySelector(".tea-form h2,.tea-result")));
    const back = page.getByRole("button", { name: "返回调整主视觉" });
    if (await back.count()) await back.click();
  }
  if (!existing) {
    await page.getByLabel("这次准备了什么下午茶？").fill("无花果下午茶海报测试样例。新鲜、多汁、清甜，突出无花果切面的细腻果肉。无真实活动信息。");
    await page.getByRole("button", { name: "AI 整理内容" }).click();
    await page.getByRole("button", { name: "确认内容，进入主视觉 →" }).waitFor({ timeout: 110000 });
    // The test food is explicit in the synthetic source. Exercise manual correction if extraction rejects a non-verbatim model answer.
    const food = page.getByLabel(/^食品/);
    if (!await food.inputValue()) await food.fill("无花果");
    await page.screenshot({ path: path.join(directory, "01-copy.png") });
    await page.getByRole("button", { name: "确认内容，进入主视觉 →" }).click();
    await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
  }
  await page.waitForFunction(() => document.querySelectorAll(".ead-option-card").length > 0 && !Array.from(document.querySelectorAll("button")).some(b => b.textContent?.includes("正在生成，请稍候")), undefined, { timeout: 240000 });
  const failed = page.getByRole("button", { name: "重试该方案" });
  if (await failed.count()) {
    await failed.first().click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll("button")).some(b => b.textContent?.includes("正在生成，请稍候")), undefined, { timeout: 240000 });
  }
  await page.locator(".ead-option-card").first().click();
  await page.screenshot({ path: path.join(directory, "02-options.png") });
  await page.getByRole("button", { name: "使用所选方案并排版 →" }).click();
  await page.getByRole("link", { name: "下载 PNG" }).waitFor({ timeout: 90000 });
  await page.screenshot({ path: path.join(directory, "03-result.png") });
  const id = new URL(page.url()).searchParams.get("job")!;
  const response = await page.request.get(`${base}/api/jobs/${id}`);
  const job = await response.json();
  const output = job.outputs.at(-1);
  const downloads = [];
  for (const format of ["png", "jpg"]) {
    const r = await page.request.get(base + output.previewUrl + (format === "jpg" ? "?format=jpg" : ""));
    if (!r.ok()) throw new Error(`下载失败 ${format}: ${r.status()}`);
    const bytes = await r.body();
    await writeFile(path.join(directory, `poster.${format}`), bytes);
    const meta = await sharp(bytes).metadata();
    if (meta.width !== 1080 || meta.height !== 1920) throw new Error("下载尺寸错误");
    downloads.push({ format, width: meta.width, height: meta.height, bytes: bytes.length });
  }
  await page.reload();
  await page.getByRole("link", { name: "下载 PNG" }).waitFor();
  const report = { jobId: id, url: page.url(), fields: job.fields, options: job.options.map((o: { status: string; provider: string; model: string }) => ({ status: o.status, provider: o.provider, model: o.model })), validation: output, downloads, pageErrors: failures };
  await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ jobId: id, options: report.options, passed: output.passed, downloads, pageErrors: failures }));
} finally { await browser.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
