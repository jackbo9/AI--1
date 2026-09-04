import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { chromium } from "playwright";
import type { PosterDocument } from "@/contracts/poster";
import { loadEmbeddedBrandAssets } from "./brand-header";
import { longformMarkup } from "./t01-longform";
import { wideMarkup } from "./t01-wide";
import { t01ContentFromDocument, type T01TemplateContent } from "./t01-template-content";
import { adaptWideContrast } from "./t01-wide-contrast";

export const extraFormats = ["landscape_1920x1080", "banner_2227x950", "longform_1080xAuto"] as const;
export type ExtraFormat = (typeof extraFormats)[number];
export const extraTemplateVersion = "t01-figma-2026-09-04-v1";
export const extraTemplateNodes = {
  landscape_1920x1080: "191:3112",
  banner_2227x950: "191:3138",
  longform_1080xAuto: "191:3158"
} as const;

export class ExtraRenderError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "ExtraRenderError"; }
}

export async function renderT01Extra(
  format: ExtraFormat,
  posterDocument: PosterDocument,
  imagePath: string,
  outputId: string,
  options: { content?: T01TemplateContent; outputDirectory?: string; readabilityMode?: "strict" | "trial"; qrDataUri?: string } = {}
) {
  if (!/^[a-zA-Z0-9-]+$/.test(outputId)) throw new ExtraRenderError("INVALID_OUTPUT_ID", "输出标识无效");
  const [brand, imageBytes, mediumFont] = await Promise.all([
    loadEmbeddedBrandAssets(), readFile(imagePath),
    readFile(path.join(process.cwd(), "public/brand/fonts/MiSans-Medium.otf"))
  ]);
  const imageMime = imagePath.endsWith(".svg") ? "image/svg+xml" : /\.jpe?g$/i.test(imagePath) ? "image/jpeg" : imagePath.endsWith(".webp") ? "image/webp" : "image/png";
  let qr: string | undefined;
  if (posterDocument.includeQr) {
    if (posterDocument.qrAssetId) {
      if (!options.qrDataUri) {
        throw new ExtraRenderError(
          "QR_ASSET_UNAVAILABLE",
          "二维码图片未准备完成，请重新上传后重试"
        );
      }
      qr = options.qrDataUri;
    } else {
      qr = await QRCode.toDataURL(posterDocument.qrPayload, {
        width: 240,
        margin: 4,
        errorCorrectionLevel: "M"
      });
    }
  }
  const assets = { companyLogo: brand.companyLogo, administrationLogo: brand.administrationMark, image: `data:${imageMime};base64,${imageBytes.toString("base64")}`, qr };
  const content = options.content ?? t01ContentFromDocument(posterDocument);
  const markup = format === "longform_1080xAuto" ? longformMarkup(content, assets) : wideMarkup(format, content, assets);
  const width = format === "landscape_1920x1080" ? 1920 : format === "banner_2227x950" ? 2227 : 1080;
  const fixedHeight = format === "landscape_1920x1080" ? 1080 : format === "banner_2227x950" ? 950 : undefined;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: fixedHeight ?? 3000 }, deviceScaleFactor: 1 });
    await page.addInitScript("globalThis.__name = (target) => target;");
    await page.goto("about:blank");
    await page.route("**/*", route => route.abort());
    await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${brand.fontFaceCss}
      @font-face{font-family:MiSans;src:url(data:font/otf;base64,${mediumFont.toString("base64")}) format('opentype');font-weight:500;font-display:block}
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:MiSans,sans-serif}img{display:block}${markup.css}
      </style></head><body>${markup.html}</body></html>`, { waitUntil: "load" });
    const ready = await page.evaluate(async () => {
      await Promise.all(Array.from(window.document.fonts).map(face => face.load().catch(() => undefined)));
      await window.document.fonts.ready;
      await Promise.all(Array.from(window.document.images).map(img => img.decode().catch(() => undefined)));
      return {
        fonts: Array.from(window.document.fonts).filter(face => face.family.replaceAll('"', '') === "MiSans").every(face => face.status === "loaded"),
        images: Array.from(window.document.images).every(img => img.complete && img.naturalWidth > 0)
      };
    });
    if (!ready.fonts || !ready.images) throw new ExtraRenderError("BRAND_ASSET_UNAVAILABLE", "字体或图像未完整加载，请重试");
    const box = await page.locator(".t01-extra").boundingBox();
    if (!box) throw new ExtraRenderError("TEMPLATE_INVALID", "模板未生成有效画布");
    const height = Math.ceil(box.height);
    if (Math.round(box.width) !== width || (fixedHeight ? height !== fixedHeight : height < 1920 || height > 12000)) {
      throw new ExtraRenderError("TEMPLATE_HEIGHT_EXCEEDED", "内容超出当前模板尺寸范围，请缩短内容后重试");
    }
    await page.setViewportSize({ width, height });
    const overflows = await page.evaluate(() => {
      const root = window.document.querySelector<HTMLElement>(".t01-extra")!;
      const bounds = root.getBoundingClientRect();
      return Array.from(root.querySelectorAll<HTMLElement>("[data-capacity],h1,h2,h3,p")).flatMap(node => {
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];
        const range = window.document.createRange(); range.selectNodeContents(node);
        const lines = new Set(Array.from(range.getClientRects()).filter(r => r.height > 0).map(r => Math.round(r.top)));
        const maximum = Number(node.dataset.maxLines || 0);
        const outside = rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1;
        // MiSans glyph extents exceed its line box; explicit line limits are
        // authoritative for text slots, not scrollHeight's font overshoot.
        const overflow = (!maximum && node.scrollHeight > node.clientHeight + 8) || node.scrollWidth > node.clientWidth + 2;
        return outside || overflow || (maximum && lines.size > maximum) ? [node.dataset.capacity || node.tagName] : [];
      });
    });
    if (overflows.length) throw new ExtraRenderError("TEMPLATE_CONTENT_OVERFLOW", `内容超出模板容量（${[...new Set(overflows)].join("、")}），请修改后重试`);
    const contrast = fixedHeight ? await adaptWideContrast(page, brand.companyLogoInverse) : undefined;
    if (contrast && !contrast.passed && options.readabilityMode !== "trial") {
      throw new ExtraRenderError("TEMPLATE_CONTRAST_FAILED", "文字与背景对比度不足，请更换主视觉后重试");
    }
    const outputPath = path.join(options.outputDirectory ?? path.join(process.cwd(), "data/generated"), `${outputId}.png`);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await page.locator(".t01-extra").screenshot({ path: outputPath, type: "png" });
    return {
      outputPath, width, height, templateVersion: extraTemplateVersion, contrast,
      checks: { fontAndLogos: true, capacity: true, outputSize: true }
    };
  } finally { await browser.close(); }
}
