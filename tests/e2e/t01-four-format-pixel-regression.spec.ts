import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";
import { longformMarkup } from "@/templates/t01-longform";
import type { T01TemplateContent } from "@/templates/t01-template-content";
import { wideMarkup } from "@/templates/t01-wide";

const content: T01TemplateContent = {
  title: "一级标题",
  slogan: "九号员工网球公开赛  /  TENNIS",
  description: "以球会友，尽兴每一拍。",
  sessions: [{ date: "XXXX年XX月XX日", time: "", location: "XX赛区" }],
  audience: "全体员工 / XX部门",
  deadline: "详见报名页",
  contact: "",
  ruleSections: [{ title: "赛事规则", body: "单人赛 / 双人赛 / 趣味赛" }],
  registrationNote: "扫码报名",
  finalistGroups: ["男单", "女单", "混合双人", "男子双人", "女子双人"].map((label) => ({
    label,
    entrants: ["XXX", "XXX", "XXX", "XXX"].map((name) => ({ name, region: "XXXX赛区" }))
  })),
  recap: { city: "XX城市", caption: "赛事现场" }
};

async function assets() {
  const brand = await loadEmbeddedBrandAssets();
  const fallback = `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), "public/brand/employee-activity-fallback.svg"))).toString("base64")}`;
  const qr = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="134" height="134"><rect width="134" height="134" fill="white"/><rect x="22" y="22" width="90" height="90" fill="#181818"/></svg>').toString("base64")}`;
  return { companyLogo: brand.companyLogo, administrationLogo: brand.administrationMark, registrationArrow: brand.registrationArrow, image: fallback, qr, recapImage: fallback };
}

async function mount(page: Page, html: string, css: string) {
  const brand = await loadEmbeddedBrandAssets();
  await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${brand.fontFaceCss}*{box-sizing:border-box}html,body{margin:0}${css}</style></head><body>${html}</body></html>`);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map((image) => image.decode())); });
}

for (const [format, size] of [["landscape_1920x1080", { width: 1920, height: 1080 }], ["banner_2227x950", { width: 2227, height: 950 }]] as const) {
  test(`T01 ${format} matches its Figma-derived baseline`, async ({ page }) => {
    await page.setViewportSize(size);
    const markup = wideMarkup(format, content, await assets());
    await mount(page, markup.html, markup.css);
    await expect(page.locator(".t01-extra")).toHaveScreenshot(`t01-${format}.png`, { maxDiffPixels: 0 });
  });
}

test("T01 longform matches its 1080 by 3000 Figma-derived baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 3000 });
  const markup = longformMarkup(content, await assets());
  await mount(page, markup.html, markup.css);
  await expect(page.locator(".t01-extra")).toHaveScreenshot("t01-longform-1080x3000.png", { maxDiffPixels: 0 });
});
