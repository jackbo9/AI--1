import { expect, test } from "@playwright/test";
const base = "http://127.0.0.1:3214";
const fields = { brief: "无花果", food: "无花果", title: "午后鲜享", subtitle: "清甜好时光", visualPrompt: "食品切面近景", time: "", place: "" };
test("scene switching retains drafts and tea stays a single-input entry", async ({ page }) => {
  await page.goto(base);
  await page.getByLabel("一级大标题").fill("羽球公开赛");
  await page.getByRole("button", { name: /02 员工福利/ }).click();
  await expect(page.getByLabel("主标题", { exact: true })).toHaveCount(0);
  await page.getByLabel("这次准备了什么下午茶？").fill("无花果");
  await page.getByRole("button", { name: /01 员工活动/ }).click();
  await expect(page.getByLabel("一级大标题")).toHaveValue("羽球公开赛");
  await page.getByRole("button", { name: /02 员工福利/ }).click();
  await expect(page.getByLabel("这次准备了什么下午茶？")).toHaveValue("无花果");
  await expect(page.locator(".tea-poster image")).toHaveCount(1);
});
test("late extraction never overwrites manual input, missing food can be corrected", async ({ page }) => {
  await page.goto(`${base}/?scene=employee-afternoon-tea`);
  let release: (() => void) | undefined;
  await page.route("**/api/tea/extract", async route => { await new Promise<void>(r => { release = r; }); await route.fulfill({ json: { fields: { ...fields, food: "" }, missing: ["food"] } }); });
  const brief = page.getByLabel("这次准备了什么下午茶？");
  await brief.fill("下午茶");
  await page.getByRole("button", { name: "AI 整理内容" }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await brief.fill("我改成了蛋糕"); release!();
  await expect(page.locator(".tea-studio .ead-error")).toContainText("未覆盖");
  await expect(brief).toHaveValue("我改成了蛋糕");
  release = undefined;
  await page.getByRole("button", { name: "AI 整理内容" }).click();
  await expect.poll(() => Boolean(release)).toBe(true); release!();
  await expect(page.locator(".tea-studio .ead-error")).toContainText("未识别到食品");
  await page.getByLabel(/^食品/).fill("蛋糕");
  await expect(page.getByLabel(/^食品/)).toHaveValue("蛋糕");
});
for (const width of [1280, 1440, 1920, 2560]) {
  test(`tea layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(`${base}/?fixture=1&scene=employee-afternoon-tea`);
    await page.getByLabel("这次准备了什么下午茶？").fill("无花果");
    await page.getByRole("button", { name: "AI 整理内容" }).click();
    await expect(page.getByLabel("画面描述", { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
    await expect(page.locator(".ead-option-card")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "使用所选方案并排版 →" })).toBeDisabled();
    await page.locator(".ead-option-card").first().click();
    await expect(page.getByRole("button", { name: "使用所选方案并排版 →" })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/tea-ui-${width}.png` });
  });
}
