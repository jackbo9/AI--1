import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import {
  employeeActivityPosterMarkup,
  preflightEmployeeActivity,
  type PosterRenderError
} from "@/templates/employee-activity";
import { employeeActivityInputSchema, posterDocumentSchema } from "@/contracts/poster";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";

const input = employeeActivityInputSchema.parse(normal);
const immutableSource = {
  outputFormat: true as const,
  sessions: true as const,
  audience: true as const,
  contact: true as const,
  includeQr: true as const,
  ctaLabel: true as const,
  qrPayload: true as const,
  qrAssetId: true as const,
  notice: true as const
};

function buildDocument(title: string, subtitle = "") {
  return posterDocumentSchema.parse({
    schemaVersion: "1.7",
    scene: "employee_activity",
    locale: "zh-CN",
    outputFormat: "portrait_1080x1920",
    category: input.category,
    title,
    subtitle,
    summary: "summary 不应偷偷进入竖版副标题",
    sessions: input.sessions,
    audience: input.audience,
    highlights: input.highlights,
    participationSteps: input.participationSteps,
    notice: input.notice,
    includeQr: false,
    ctaLabel: "",
    qrPayload: "",
    qrAssetId: "",
    contact: input.contact,
    immutableSource
  });
}

async function renderMarkup(title: string, subtitle = "") {
  const assets = await loadEmbeddedBrandAssets();
  const fallbackPath = path.join(
    process.cwd(),
    "public",
    "brand",
    "employee-activity-fallback.svg"
  );
  const fallback = `data:image/svg+xml;base64,${(await readFile(fallbackPath)).toString("base64")}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.setContent(
    employeeActivityPosterMarkup(buildDocument(title, subtitle), fallback, "", assets),
    { waitUntil: "load" }
  );
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

async function lineCount(page: import("playwright").Page, selector: string) {
  return page.$eval(selector, (element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return new Set(
      Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
        .map((rect) => Math.round(rect.top))
    ).size;
  });
}

describe("T01 multiline portrait layout", () => {
  it("keeps 1–3 lines natural, pushes subtitle by 13px, and stays 1080×1920", async () => {
    const cases = [
      ["赛事主题", 1],
      ["赛事主题赛事主题赛事", 2],
      ["赛事主题赛事主题赛事主题赛事主题", 3]
    ] as const;
    for (const [title, expectedLines] of cases) {
      const { browser, page } = await renderMarkup(
        title,
        "报名参与赛事主题活动，和同事一起完成挑战，享受友好竞赛与团队协作的乐趣"
      );
      try {
        expect(await lineCount(page, "[data-poster-title]")).toBe(expectedLines);
        expect(await lineCount(page, "[data-poster-subtitle]")).toBe(2);
        const boxes = await page.evaluate(() => {
          const title = document.querySelector<HTMLElement>("[data-poster-title]")!;
          const subtitle = document.querySelector<HTMLElement>("[data-poster-subtitle]")!;
          const titleBox = title.getBoundingClientRect();
          const subtitleBox = subtitle.getBoundingClientRect();
          return {
            gap: subtitleBox.top - titleBox.bottom,
            titleHeight: titleBox.height,
            width: document.querySelector(".poster")?.getBoundingClientRect().width,
            height: document.querySelector(".poster")?.getBoundingClientRect().height
          };
        });
        expect(boxes.gap).toBeCloseTo(13, 0);
        expect(boxes.width).toBe(1080);
        expect(boxes.height).toBe(1920);
        if (expectedLines === 3) expect(boxes.titleHeight).toBeCloseTo(432, 0);
      } finally {
        await browser.close();
      }
    }
  });

  it("blocks a fourth line before any image rendering and omits empty subtitle markup", async () => {
    const overflowing = buildDocument("这是一条超过三行且接近四十字的活动主题用于验证标题溢出会被阻止生成");
    let error: unknown;
    try {
      await preflightEmployeeActivity(overflowing);
    } catch (caught) {
      error = caught;
    }
    expect((error as PosterRenderError).code).toBe("brand.title.max_lines");

    const { browser, page } = await renderMarkup("赛事主题", "");
    try {
      expect(await page.$("[data-poster-subtitle]")).toBeNull();
      expect(await page.content()).not.toContain("summary 不应偷偷进入竖版副标题");
    } finally {
      await browser.close();
    }
  });
});
