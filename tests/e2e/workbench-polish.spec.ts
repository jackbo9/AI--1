import { expect, test } from "@playwright/test";
import type { TeaJob } from "../../src/contracts/tea";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3214";
test.setTimeout(60000);

test("rules show required marker and empty/whitespace submissions focus the field", async ({ page }) => {
  await page.goto(`${base}/?fixture=1`);
  const rules = page.getByLabel("04 赛事规则");
  await expect(rules).toHaveAttribute("required", "");
  await expect(page.locator("label").filter({ hasText: "04 赛事规则" }).getByLabel("必填")).toBeVisible();
  for (const value of ["", "   "]) {
    await rules.fill(value);
    await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
    await expect(page.locator(".ead-error[role=alert]")).toHaveText("请填写赛事规则");
    await expect(rules).toBeFocused();
  }
  await rules.fill("三局两胜");
  await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
  await expect(page.getByRole("button", { name: "生成主视觉描述", exact: true })).toBeVisible();
});

test("replace visual opens saved description and retains options until explicit generation", async ({ page }) => {
  await page.goto(`${base}/?fixture=1`);
  await page.getByRole("button", { name: "确认文案，进入主视觉 →" }).click();
  await page.getByRole("button", { name: "生成主视觉描述", exact: true }).click();
  const description = page.getByLabel("主视觉描述", { exact: true });
  const saved = "羽毛球拍与羽毛球特写，绿色背景，自然光线，真实体育摄影。";
  await description.fill(saved);
  await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
  await expect(page.locator(".ead-option-card")).toHaveCount(2);
  await page.locator(".ead-option-card").first().click();
  await page.getByRole("button", { name: "使用所选方案并排版 →" }).click();
  await page.getByRole("button", { name: "只换主视觉", exact: true }).click();
  await expect(description).toBeVisible();
  await expect(description).toHaveValue(saved);
  const regenerate = page.getByRole("button", { name: "重新生成两张主视觉", exact: true });
  await expect(regenerate).toBeEnabled();
  await expect(page.getByRole("heading", { name: "2 检查描述" })).toBeInViewport();
  await expect(page.locator(".ead-option-card")).toHaveCount(2);
  await page.screenshot({ path: "test-results/polish-replace-visual.png" });
  await regenerate.click();
  await expect(page.locator(".ead-option-card")).toHaveCount(4);
});

test("tea missing-food recovery submits source foods and consistent labels", async ({ page }) => {
  const brief = "本周五准备了喜茶奶茶和乐乐茶面包作为下午茶";
  const fields = { brief, food: "喜茶奶茶、乐乐茶面包", title: "午后鲜享", subtitle: "清甜好时光", visualPrompt: "一杯喜茶奶茶，旁边放着乐乐茶面包，自然光线，真实食品摄影。", time: "本周五", place: "" };
  let missing = true;
  let job: TeaJob;
  let createCount = 0, generateCount = 0;
  await page.route("**/api/tea/extract", route => route.fulfill({ json: { fields: { ...fields, food: missing ? "" : fields.food }, missing: missing ? ["food"] : [] } }));
  await page.route("**/api/jobs", route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { jobs: [] } });
    const body = route.request().postDataJSON();
    expect(body.fields.food).toBe(fields.food);
    createCount++;
    job = { ...body, id: "00000000-0000-4000-8000-000000000001", userId: "test", sourceVersionId: "00000000-0000-4000-8000-000000000002", actionIdempotencyKeys: [], status: "READY_FOR_VISUAL_REVIEW", options: [], outputs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return route.fulfill({ json: job });
  });
  await page.route("**/api/jobs/*/confirm-visual", route => {
    generateCount++;
    job.options = [0, 1].map(index => ({ id: String(index), batchId: "test", direction: "近景", description: fields.visualPrompt, sourceVersionId: job.sourceVersionId, status: "READY", previewUrl: "/brand/employee-activity-fallback.svg" }));
    return route.fulfill({ json: job });
  });
  await page.goto(`${base}/?scene=employee-afternoon-tea`);
  const input = page.getByLabel("这次准备了什么下午茶？");
  await input.fill(brief);
  await page.getByRole("button", { name: "AI 整理内容", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "未识别到食品" })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成两张主视觉", exact: true })).toBeDisabled();
  await expect(input).toHaveValue(brief);
  expect(createCount).toBe(0);
  missing = false;
  await page.getByRole("button", { name: "AI 整理内容", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 检查描述" })).toBeVisible();
  await expect(page.getByLabel("主视觉描述", { exact: true })).toHaveValue(fields.visualPrompt);
  await expect(page.getByRole("button", { name: "AI 重新生成描述" })).toBeVisible();
  await page.getByRole("button", { name: "生成两张主视觉", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2 比较图片" })).toBeVisible();
  await expect(page.locator(".ead-option-card")).toHaveCount(2);
  expect(createCount).toBe(1);
  expect(generateCount).toBe(1);
  await expect(page.locator(".tea-studio .ead-error")).toHaveCount(0);
  await page.screenshot({ path: "test-results/polish-tea.png", fullPage: true });
});
