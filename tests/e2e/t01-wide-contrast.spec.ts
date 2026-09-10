import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";
import { adaptWideContrast } from "@/templates/t01-wide-contrast";
import { longformMarkup } from "@/templates/t01-longform";
import type { T01TemplateContent } from "@/templates/t01-template-content";
import { wideMarkup } from "@/templates/t01-wide";

const content: T01TemplateContent = {
  title: "飞盘锦标赛",
  slogan: "九号员工飞盘俱乐部锦标赛 / ULTIMATE FRISBEE",
  description: "飞盘俱乐部锦标赛，等你来战！",
  sessions: [{ date: "2026年09月18日", time: "", location: "园区运动场" }],
  audience: "全体员工",
  deadline: "",
  contact: "",
  ruleSections: [{ title: "赛事规则", body: "团队竞技，遵守现场裁判安排。" }],
  registrationNote: ""
};

const darkBackground =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2227" height="3000"><rect width="100%" height="100%" fill="#111"/></svg>'
  ).toString("base64");

async function mount(page: Page, html: string, css: string) {
  const brand = await loadEmbeddedBrandAssets();
  await page.setContent(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${brand.fontFaceCss}*{box-sizing:border-box}html,body{margin:0}${css}</style></head><body>${html}</body></html>`
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => image.decode()));
  });
  await adaptWideContrast(page, brand.companyLogoInverse, brand.companyLogo);
}

for (const testCase of [
  {
    name: "landscape",
    format: "landscape_1920x1080" as const,
    viewport: { width: 1920, height: 1080 },
    divider: ".t01-wide-divider"
  },
  {
    name: "banner",
    format: "banner_2227x950" as const,
    viewport: { width: 2227, height: 950 },
    divider: ".t01-wide-divider"
  }
]) {
  test(`T01 ${testCase.name} divider follows the light title tone`, async ({ page }) => {
    const brand = await loadEmbeddedBrandAssets();
    await page.setViewportSize(testCase.viewport);
    const markup = wideMarkup(testCase.format, content, {
      companyLogo: brand.companyLogo,
      administrationLogo: brand.administrationMark,
      registrationArrow: brand.registrationArrow,
      image: darkBackground
    });
    await mount(page, markup.html, markup.css);

    await expect(page.locator(".t01-wide-title-block")).toHaveCSS(
      "color",
      "rgb(255, 255, 255)"
    );
    for (const selector of [".t01-wide-eyebrow", ".t01-wide-title", ".t01-wide-description"]) {
      await expect(page.locator(selector)).toHaveCSS("color", "rgb(255, 255, 255)");
    }
    await expect(page.locator(testCase.divider)).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
    await expect(page.locator("[data-brand-company-logo]")).toHaveAttribute(
      "data-logo-variant",
      "inverse"
    );
  });
}

test("T01 longform company logo follows the title tone", async ({ page }) => {
  const brand = await loadEmbeddedBrandAssets();
  await page.setViewportSize({ width: 1080, height: 3000 });
  const markup = longformMarkup(content, {
    companyLogo: brand.companyLogo,
    administrationLogo: brand.administrationMark,
    registrationArrow: brand.registrationArrow,
    image: darkBackground
  });
  await mount(page, markup.html, markup.css);

  const titleTone = await page.locator(".lf-title-block").evaluate((element) =>
    getComputedStyle(element).color
  );
  await expect(page.locator(".lf-hero-divider")).toHaveCSS(
    "background-color",
    titleTone
  );
  await expect(page.locator("[data-brand-company-logo]")).toHaveAttribute(
    "data-logo-variant",
    titleTone === "rgb(255, 255, 255)" ? "inverse" : "primary"
  );
});
