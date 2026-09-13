import { expect, test } from "@playwright/test";
import normal from "../fixtures/employee-activity.normal.json";
import { employeeActivityInputSchema } from "../../src/contracts/poster";
import { createFixtureBaseVisualJob, createFixtureVisualOptionJob, createFixtureReadyJob } from "../../src/components/activity-studio-fixture";

test("waits for portrait readiness and automatically recovers all selected format previews", async ({ page }) => {
  const input = employeeActivityInputSchema.parse(normal);
  const job = createFixtureReadyJob(createFixtureVisualOptionJob(createFixtureBaseVisualJob(input), "羽毛球场地，真实运动摄影"));
  job.id = "automatic-format-test";
  const formats = ["portrait_1080x1920", "landscape_1920x1080", "banner_2227x950", "longform_1080xAuto"] as const;
  job.campaignBrief = { renderTargets: [...formats] };
  let reads = 0;
  let ready = false;
  let premature = 0;
  const calls = new Map<string, number>();
  await page.route("**/api/jobs/automatic-format-test", route => {
    ready = ++reads >= 2;
    return route.fulfill({ json: { ...job, status: ready ? "READY_FOR_REVIEW" : "RENDERING" } });
  });
  await page.route("**/api/jobs/automatic-format-test/formats", async route => {
    if (route.request().method() === "POST") {
      if (!ready) premature++;
      const format = route.request().postDataJSON().format as string;
      const count = (calls.get(format) ?? 0) + 1;
      calls.set(format, count);
      if (format === "landscape_1920x1080" && count === 1) {
        await route.fulfill({ status: 503, json: { error: { message: "临时不可用" } } });
      } else {
        await route.fulfill({ status: 202, json: {} });
      }
      return;
    }
    await route.fulfill({ json: { currentVisualFamilyId: "current", outputs: formats.slice(1).map(format => ({
      id: format, format, status: "READY", width: 1080, height: 1920, visualFamilyId: "current",
      previewUrl: "/fixtures/employee-activity-poster.svg", validation: { passed: true, exportAllowed: true, messages: [] }
    })) } });
  });
  await page.goto("http://127.0.0.1:3213/?job=automatic-format-test");
  await expect(page.getByText("正在排版导出", { exact: true })).toBeVisible();
  for (const label of ["竖版", "横版", "Banner", "长图"]) {
    await page.getByRole("group", { name: "切换最终物料尺寸" }).getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".ead-final-viewer img").first()).toBeVisible();
  }
  const canvas = page.getByRole("region", { name: /海报缩放预览/ });
  await canvas.hover();
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => Number(await canvas.getAttribute("data-zoom"))).toBeGreaterThan(1);
  const firstScale = Number(await canvas.getAttribute("data-zoom"));
  await page.mouse.wheel(0, -60);
  await expect.poll(async () => Number(await canvas.getAttribute("data-zoom"))).toBeGreaterThan(firstScale);
  await canvas.dblclick();
  await expect(canvas).toHaveAttribute("data-zoom", "1");
  await canvas.focus();
  await page.keyboard.press("-");
  await expect.poll(async () => Number(await canvas.getAttribute("data-zoom"))).toBeLessThan(1);
  await page.keyboard.press("0");
  await expect(canvas).toHaveAttribute("data-zoom", "1");
  expect(premature).toBe(0);
  expect(calls.get("landscape_1920x1080")).toBe(2);
  expect(calls.get("banner_2227x950")).toBe(1);
  expect(calls.get("longform_1080xAuto")).toBe(1);
  await expect(page.getByRole("button", { name: "重新读取" })).toHaveCount(0);
});
