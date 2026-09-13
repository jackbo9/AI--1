import { expect, test } from "@playwright/test";
import sharp from "sharp";

const base = "http://127.0.0.1:3213";
test.setTimeout(120_000);

test("empty new form, editable roster with immediate feedback and optional QR", async ({ page }) => {
  await page.goto(base);
  await expect(page.getByLabel("一级大标题")).toHaveValue("");
  await expect(page.getByLabel("01 比赛日期")).toHaveValue("");
  await page.getByLabel("一级大标题").fill("羽球赛");
  await page.getByLabel("宣言标题").fill("九号员工羽球赛 / BADMINTON");
  await page.getByLabel("副标题", { exact: false }).fill("一起上场");
  await page.getByLabel("01 比赛日期").fill("2026-09-18");
  await page.getByLabel("02 比赛地点").fill("体育馆");
  await page.getByLabel("03 参与对象").fill("全体员工");
  await page.getByLabel("04 赛事规则").fill("三局两胜");
  await page.getByRole("button", { name: /长图.*1080/ }).click();
  const group = page.getByRole("textbox", { name: "第1组名称", exact: true });
  await group.fill("");
  await group.pressSequentially("公开组");
  await expect(group).toBeFocused();
  await page.getByRole("textbox", { name: "公开组第1人姓名" }).fill("张三");
  await expect(page.locator(".t01-preview-longform-roster")).toContainText("张三");
  await expect(page.locator(".t01-preview-longform-roster")).toContainText("待填赛区");
  await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
  await expect(page.locator(".ead-error")).toContainText("补齐");
  await page.getByRole("textbox", { name: "公开组第1人赛区" }).fill("华东");
  await page.screenshot({ path: "test-results/iteration-roster.png" });
  await page.getByRole("button", { name: "＋ 添加", exact: true }).click();
  await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
  await expect(page.locator(".ead-error")).toContainText("添加二维码后");
  await page.getByRole("button", { name: "○ 不添加" }).click();
  await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
  await expect(page.getByLabel("主视觉描述", { exact: true })).toHaveCount(0);
  await page.route("**/refine-visual", route => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { message: "描述生成失败，请重试" } }) }));
  let refinements = 0;
  page.on("request", request => { if (request.url().includes("/refine-visual")) refinements += 1; });
  await page.getByRole("button", { name: "生成主视觉描述", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator(".ead-error")).toContainText("描述生成失败");
  await expect(page.getByLabel("主视觉描述", { exact: true })).toHaveCount(0);
  expect(refinements).toBe(1);
  const url = page.url();
  await page.reload();
  await expect(page.getByRole("button", { name: "生成主视觉描述", exact: true })).toBeVisible();
  expect(page.url()).toBe(url);
  await page.getByRole("button", { name: /填写与确认文案/ }).click();
  await expect(page.getByLabel("一级大标题")).toHaveValue("羽球赛");
  await expect(group).toHaveValue("公开组");
  await page.getByLabel("一级大标题").fill("羽球公开赛");
  await expect(page.getByRole("button", { name: "确认文案，进入主视觉 →" })).toBeVisible();
});

test("QR link and upload can both be removed before generation", async ({ page }) => {
  await page.goto(base);
  await page.getByRole("button", { name: "＋ 添加", exact: true }).click();
  const link = page.getByPlaceholder("粘贴报名 URL（会生成二维码）");
  await link.fill("https://example.com/signup");
  await expect(page.locator(".t01-preview-qr img")).toBeVisible();
  const bytes = await sharp({ create: { width: 256, height: 256, channels: 3, background: "white" } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "test-qr.png", mimeType: "image/png", buffer: bytes });
  await expect(page.locator(".ead-upload-status")).toContainText("已上传");
  await expect(link).toHaveValue("");
  await page.getByRole("button", { name: "○ 不添加" }).click();
  await expect(page.locator(".t01-preview-qr")).toHaveCount(0);
  await page.getByRole("button", { name: "＋ 添加", exact: true }).click();
  await expect(link).toHaveValue("");
  await expect(page.locator(".ead-upload-status")).not.toContainText("已上传");
});

test("AI descriptions appear on demand and manual edits survive variable changes", async ({ page }) => {
  await page.goto(base + "/?fixture=1");
  await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
  const description = page.getByLabel("主视觉描述", { exact: true });
  await expect(description).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成两张主视觉", exact: true })).toHaveCount(0);
  await expect(page.locator(".ead-option-section")).toHaveCount(0);
  await page.getByLabel("人物", { exact: true }).selectOption("allow");
  await page.getByRole("button", { name: "生成主视觉描述", exact: true }).click();
  await expect(description).toBeVisible();
  const manual = "运动员手握球拍击球的瞬间，蓝色背景，真实体育摄影。";
  await description.fill(manual);
  await page.getByRole("button", { name: "修改画面设置" }).click();
  await page.getByLabel("主题色", { exact: true }).selectOption("green");
  await expect(description).toHaveValue(manual);
  await expect(page.getByRole("button", { name: "生成两张主视觉", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "AI 重新生成描述" }).click();
  await expect(description).toBeEnabled();
  await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
  await expect(page.locator(".ead-option-card")).toHaveCount(2);
  await expect(description).toHaveCount(0);
  await page.getByRole("button", { name: "查看或修改描述" }).click();
  await expect(description).toBeVisible();
  await expect(page.getByRole("button", { name: "使用所选方案并排版 →" })).toBeDisabled();
});

for (const width of [1280, 1440, 1920, 2560]) {
  test("readability at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(base + "/?fixture=1");
    const input = page.getByLabel("一级大标题");
    expect(await input.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await expect(page.getByRole("group", { name: "界面字号" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(page.locator("#employee-activity-demo")).toHaveAttribute("data-text-size", "large");
    await page.screenshot({ path: "test-results/iteration-" + width + ".png", fullPage: true });
  });
}

test("real local pipeline exports PNG and JPG in all four formats without QR", async ({ page, request }) => {
  await page.goto(base + "/?fixture=1");
  // Obtain a complete input from the UI, then use the real local API with no model configuration.
  let captured: Record<string, unknown> | undefined;
  await page.route("**/api/jobs", async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: { message: "Captured local test input" } }) });
  });
  await page.goto(base);
  await page.getByLabel("一级大标题").fill("羽球赛");
  await page.getByLabel("宣言标题").fill("九号员工羽球赛 / BADMINTON");
  await page.getByLabel("副标题", { exact: false }).fill("一起上场");
  await page.getByLabel("01 比赛日期").fill("2026-09-18");
  await page.getByLabel("02 比赛地点").fill("体育馆");
  await page.getByLabel("03 参与对象").fill("全体员工");
  await page.getByLabel("04 赛事规则").fill("三局两胜");
  await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
  await expect.poll(() => captured).toBeTruthy();
  await page.unroute("**/api/jobs");
  const targets = ["portrait_1080x1920", "landscape_1920x1080", "banner_2227x950", "longform_1080xAuto"];
  const create = await request.post(base + "/api/jobs", { data: { ...captured, renderTargets: targets } });
  expect(create.status()).toBe(202);
  const { jobId } = await create.json();
  const getJob = async () => (await request.get(base + "/api/jobs/" + jobId)).json();
  const initial = await getJob();
  const preferences = { peopleMode: "allow", themeColor: "blue", visualType: "action", visualTreatment: "" };
  const confirm = await request.post(base + "/api/jobs/" + jobId + "/confirm-visual", { data: {
    sourceDraftCreatedAt: initial.visualDraft.createdAt, description: "运动员手握羽毛球拍击球瞬间，蓝色背景，真实体育摄影。",
    preferences, idempotencyKey: crypto.randomUUID()
  } });
  expect(confirm.status()).toBe(202);
  await expect.poll(async () => (await getJob()).visualOptions.length, { timeout: 30000 }).toBe(1);
  const visual = await getJob();
  expect(visual.confirmedVisual.preferences).toEqual(preferences);
  expect(visual.visualOptions[0].preferences).toEqual(preferences);
  expect(visual.visualOptions[0].brief.systemDirection).toContain("画面包含运动员局部");
  const rendered = await request.post(base + "/api/jobs/" + jobId + "/visual-options/confirm", { data: { optionId: visual.selectedVisualOptionId, idempotencyKey: crypto.randomUUID() } });
  expect(rendered.status()).toBe(202);
  await expect.poll(async () => (await getJob()).status, { timeout: 60000 }).toBe("READY_FOR_REVIEW");
  for (const target of targets.slice(1)) {
    const response = await request.post(base + "/api/jobs/" + jobId + "/formats", { data: { format: target } });
    expect(response.status()).toBe(202);
  }
  await expect.poll(async () => (await getJob()).artifacts.filter((artifact: { status: string }) => artifact.status === "READY").length, { timeout: 60000 }).toBeGreaterThanOrEqual(4);
  const job = await getJob();
  for (const target of targets) {
    const artifact = job.artifacts.findLast((item: { renderTargetId: string; status: string }) => item.renderTargetId === target && item.status === "READY");
    const url = base + "/api/files/" + artifact.outputPath.split("/").at(-1);
    const png = await request.get(url);
    const jpg = await request.get(url + "?format=jpg");
    expect(png.status()).toBe(200);
    expect(jpg.status()).toBe(200);
    const original = await sharp(await png.body()).metadata();
    expect(await sharp(await jpg.body()).metadata()).toMatchObject({ width: original.width, height: original.height, format: "jpeg" });
    await test.info().attach(target + ".png", { body: await png.body(), contentType: "image/png" });
  }
  await page.goto(base + "/?job=" + jobId);
  await expect(page.getByRole("button", { name: "下载 JPG", exact: true })).toBeVisible();
  await page.route("**/*format=jpg", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await page.getByRole("button", { name: "下载 JPG", exact: true }).click();
  await expect(page.locator(".ead-final-download")).toContainText("JPG 转换失败");
  await expect(page.locator(".ead-final-download a")).toBeVisible();
  await page.unroute("**/*format=jpg");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JPG", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toContain(".jpg");
  await page.screenshot({ path: "test-results/iteration-result.png" });
});
