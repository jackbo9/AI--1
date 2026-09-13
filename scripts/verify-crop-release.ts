import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

async function main() {
  if (process.env.ALLOW_PAID_MODEL_PROBE !== "1") throw Error("Set ALLOW_PAID_MODEL_PROBE=1 for one real description and two images");
  const base = "http://127.0.0.1:3213";
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    if (!process.argv[2]) {
    await page.goto(base);
    await page.getByLabel("一级大标题").fill("篮球挑战赛");
    await page.getByLabel("宣言标题").fill("九号员工篮球挑战赛 / BASKETBALL");
    await page.getByLabel("副标题", { exact: false }).fill("以球会友，挑战自我");
    await page.getByLabel("01 比赛日期").fill("2026-09-18");
    await page.getByLabel("02 比赛地点").fill("九号园区体育馆");
    await page.getByLabel("03 参与对象").fill("全体员工");
    await page.getByLabel("04 赛事规则").fill("小组循环赛，三局两胜");
    for (const name of [/横版.*1920/, /Banner.*2227/, /长图.*1080/]) await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
    await expect(page.getByLabel("人物", { exact: true })).toBeVisible();
    await page.getByLabel("人物", { exact: true }).selectOption("forbid");
    await page.getByLabel("视觉类型", { exact: true }).selectOption("equipment");
    await page.getByRole("button", { name: "生成主视觉描述", exact: true }).click();
    const description = page.getByLabel("主视觉描述", { exact: true });
    await expect(description).toBeVisible({ timeout: 180000 });
    await description.fill((await description.inputValue()).slice(0, 380) + "。篮球与篮网交汇为唯一主焦点，背景克制。");
    const generating = page.waitForResponse(r => r.url().endsWith("/confirm-visual") && r.request().method() === "POST");
    await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
    if ((await generating).status() !== 202) throw Error("Visual confirmation failed");
    } else {
      await page.goto(base + "/?job=" + process.argv[2]);
      const replace = page.getByRole("button", { name: "只换主视觉", exact: true });
      if (await replace.isVisible()) await replace.click();
    }
    const id = new URL(page.url()).searchParams.get("job")!;
    console.log(JSON.stringify({ jobId: id, stage: "generating-pair" }));
    const read = async () => (await page.request.get(base + "/api/jobs/" + id)).json();
    await expect.poll(async () => {
      const job = await read();
      return job.visualBatches?.length && job.status;
    }, { timeout: 420000, intervals: [3000] }).toBe("READY_FOR_VISUAL_REVIEW");
    const pair = await read();
    if (pair.visualOptions.length !== 2) throw Error("Two real options not completed: " + JSON.stringify(pair.visualBatches));
    if (!process.argv[2]) await expect(page.getByRole("button", { name: "使用所选方案并排版 →" })).toBeDisabled();
    await page.locator(".ead-option-card").first().click();
    await expect(page.getByRole("button", { name: "使用所选方案并排版 →" })).toBeEnabled();
    const confirmed = page.waitForResponse(r => r.url().endsWith("/visual-options/confirm") && r.request().method() === "POST");
    await page.getByRole("button", { name: "使用所选方案并排版 →" }).click();
    if ((await confirmed).status() !== 202) throw Error("Layout confirmation failed");
    await expect.poll(async () => {
      const current = await read();
      return current.status === "READY_FOR_REVIEW" && current.artifacts.filter((a: { status: string; visualFamilyId: string }) => a.visualFamilyId === current.visualMaster?.visualFamilyId && a.status === "READY").length;
    }, { timeout: 180000, intervals: [2000] }).toBe(4);
    await page.reload();
    await mkdir("test-results/crop-release", { recursive: true });
    const job = await read();
    job.artifacts = job.artifacts.filter((a: { visualFamilyId: string }) => a.visualFamilyId === job.visualMaster.visualFamilyId);
    const paths = new Set(job.artifacts.map((a: { assetPath: string }) => a.assetPath));
    if (paths.size !== 1) throw Error("Outputs do not share the original mother");
    const report = [];
    for (const a of job.artifacts) {
      if (a.adaptationMode !== "template-crop-v1") throw Error("Unexpected adaptation mode");
      for (const format of ["png", "jpg"]) {
        const response = await page.request.get(base + "/api/files/" + a.outputPath.split("/").at(-1) + (format === "jpg" ? "?format=jpg" : ""));
        if (!response.ok()) throw Error("Download failed");
        const bytes = await response.body();
        const meta = await sharp(bytes).metadata();
        if (meta.width !== a.width || meta.height !== a.height || meta.format !== (format === "jpg" ? "jpeg" : "png")) throw Error("Export dimensions or format mismatch");
        await writeFile(`test-results/crop-release/${a.renderTargetId}.${format}`, bytes);
      }
      report.push({ target: a.renderTargetId, width: a.width, height: a.height, assetPath: a.assetPath, validation: a.validation });
    }
    for (const label of ["竖版", "横版", "Banner", "长图"]) {
      await page.getByRole("group", { name: "切换最终物料尺寸" }).getByRole("button", { name: label, exact: true }).click();
      await expect(page.locator(".ead-final-viewer img").first()).toBeVisible();
    }
    await page.screenshot({ path: "test-results/crop-release/browser.png" });
    await writeFile("test-results/crop-release/report.json", JSON.stringify({ jobId: id, pair: pair.visualOptions.map((o: { id: string; imageModel: string }) => ({ id: o.id, model: o.imageModel })), outputs: report }, null, 2));
    console.log(JSON.stringify({ jobId: id, result: "four formats and eight downloads passed" }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
