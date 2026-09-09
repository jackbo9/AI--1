import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import {
  employeeActivityPosterMarkup,
  preflightEmployeeActivity
} from "@/templates/employee-activity";
import {
  employeeActivityInputSchema,
  posterDocumentSchema,
  type PosterDocument
} from "@/contracts/poster";
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

function buildDocument(
  title: string,
  subtitle = "",
  patch: Partial<PosterDocument> = {}
) {
  return posterDocumentSchema.parse({
    schemaVersion: "1.7",
    scene: "employee_activity",
    locale: "zh-CN",
    outputFormat: "portrait_1080x1920",
    category: input.category,
    title,
    slogan: "九号员工赛事 / EVENT",
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
    immutableSource,
    ...patch
  });
}

async function renderDocument(posterDocument: PosterDocument, qr = "") {
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
    employeeActivityPosterMarkup(posterDocument, fallback, qr, assets),
    { waitUntil: "load" }
  );
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

async function renderMarkup(title: string, subtitle = "") {
  return renderDocument(buildDocument(title, subtitle));
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
  it("keeps one or two title lines, preserves manual breaks, and stays 1080×1920", async () => {
    const cases = [
      ["赛事主题", 1],
      ["赛事主题\n热爱不设限", 2]
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
        expect(boxes.gap).toBeCloseTo(22, 0);
        expect(boxes.width).toBe(1080);
        expect(boxes.height).toBe(1920);
        if (expectedLines === 2) expect(boxes.titleHeight).toBeCloseTo(260, 0);
      } finally {
        await browser.close();
      }
    }
  }, 20_000);

  it("accepts a manual two-line title and omits empty subtitle markup", async () => {
    await expect(
      preflightEmployeeActivity(
        buildDocument(
          "羽球挑战赛\n热爱不设限",
          "副".repeat(40)
        )
      )
    ).resolves.toBeUndefined();
    const { browser, page } = await renderMarkup("赛事主题", "");
    try {
      expect(await page.$("[data-poster-subtitle]")).toBeNull();
      expect(await page.content()).not.toContain("summary 不应偷偷进入竖版副标题");
    } finally {
      await browser.close();
    }
  }, 20_000);

  it("blocks a title that naturally wraps beyond two lines", async () => {
    await expect(
      preflightEmployeeActivity(
        buildDocument("赛事主题赛事主题赛事主题赛事主题")
      )
    ).rejects.toMatchObject({
      code: "brand.title.max_lines"
    });
  }, 20_000);

  it("flows the required slogan into the title group with the Figma 22px gap", async () => {
    const { browser, page } = await renderDocument(buildDocument("赛事主题"));
    try {
      const geometry = await page.evaluate(() => {
        const eyebrow = document.querySelector<HTMLElement>("[data-poster-slogan]")!;
        const title = document.querySelector<HTMLElement>("[data-poster-title]")!;
        return {
          eyebrowTop: eyebrow.getBoundingClientRect().top,
          gap: title.getBoundingClientRect().top - eyebrow.getBoundingClientRect().bottom,
          eyebrowText: eyebrow.textContent
        };
      });
      expect(geometry.eyebrowTop).toBeCloseTo(222, 0);
      expect(geometry.gap).toBeCloseTo(22, 0);
      expect(geometry.eyebrowText?.trim()).toBe("九号员工赛事 / EVENT");
    } finally {
      await browser.close();
    }
  }, 20_000);

  it("keeps the split facts in one flow and protects the QR column", async () => {
    const posterDocument = buildDocument("双城同行日", "一起出发，认识不同团队的新伙伴", {
      sessions: [
        input.sessions[0],
        {
          label: "常州站",
          date: "2026-09-20",
          time: "14:00–17:30",
          location: "常州制造基地共享空间",
          details: []
        }
      ],
      includeQr: true,
      ctaLabel: "扫码加入活动",
      qrPayload: "https://example.com/register"
    });
    const qr =
      "data:image/svg+xml;base64," +
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"/>').toString(
        "base64"
      );
    const { browser, page } = await renderDocument(posterDocument, qr);
    try {
      const layout = await page.evaluate(() => {
        const time = document.querySelector<HTMLElement>(
          "[data-poster-session-time]"
        )!;
        const location = document.querySelector<HTMLElement>(
          "[data-poster-session-location]"
        )!;
        const audience = document.querySelector<HTMLElement>(
          ".audience-group"
        )!;
        const participation = document.querySelector<HTMLElement>(
          ".participation-group"
        )!;
        const qr = document.querySelector<HTMLElement>("[data-poster-qr]")!;
        const boxes = [time, location, audience, participation].map((element) =>
          element.getBoundingClientRect()
        );
        const qrBox = qr.getBoundingClientRect();
        const overlapsQr = boxes.some(
          (box) =>
            box.left < qrBox.right &&
            box.right > qrBox.left &&
            box.top < qrBox.bottom &&
            box.bottom > qrBox.top
        );
        return {
          order: boxes.map((box) => box.top),
          audienceWidth: audience.getBoundingClientRect().width,
          participationWidth: participation.getBoundingClientRect().width,
          overlapsQr,
          qrLabel: qr.querySelector("p")?.textContent
        };
      });
      expect(layout.order).toEqual([...layout.order].sort((left, right) => left - right));
      expect(layout.audienceWidth).toBeCloseTo(349, 0);
      expect(layout.participationWidth).toBeCloseTo(320, 0);
      expect(layout.overlapsQr).toBe(false);
      expect(layout.qrLabel).toBe("扫码加入活动");
    } finally {
      await browser.close();
    }
  }, 20_000);
});
