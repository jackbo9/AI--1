import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import normal from "../fixtures/employee-activity.normal.json";
import { posterDocumentSchema } from "@/contracts/poster";
import { employeeActivityPosterMarkup } from "@/templates/employee-activity";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";

test("T01 portrait matches the approved pixel baseline", async ({ page }) => {
  const assets = await loadEmbeddedBrandAssets();
  const fallback = `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), "public/brand/employee-activity-fallback.svg"))).toString("base64")}`;
  const posterDocument = posterDocumentSchema.parse({
    schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN", outputFormat: "portrait_1080x1920",
    category: normal.category, title: "羽球挑战赛", slogan: "九号员工羽毛球挑战赛 / BADMINTON", subtitle: "零基础也能参加，现场自由组队", sessions: normal.sessions.slice(0, 1), audience: normal.audience,
    highlights: [], participationSteps: ["小组循环赛", "三局两胜"], notice: "晋升通道：详见报名页", includeQr: false, ctaLabel: "", qrPayload: "", qrAssetId: "", contact: normal.contact,
    immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true }
  });
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(employeeActivityPosterMarkup(posterDocument, fallback, "", assets));
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".poster")).toHaveScreenshot("t01-figma-portrait.png", { maxDiffPixels: 0 });
});
