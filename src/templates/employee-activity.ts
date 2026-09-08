import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { chromium, type Page } from "playwright";
import type { PosterDocument } from "@/contracts/poster";
import { brandHeaderMarkup, loadEmbeddedBrandAssets } from "./brand-header";
import {
  T01_READABILITY_REGIONS,
  contrastPasses,
  logoVariantForTreatment,
  selectT01Treatments,
  type T01CandidateMeasurement,
  type T01ReadabilityReport,
  type T01RegionAnalysis,
  type T01ZoneTreatment
} from "./t01-readability";
import { t01PortraitLayout } from "./t01-portrait-layout";

export const employeeActivityTemplate = {
  id: "employee-activity-portrait",
  version: "2.0.0-figma-426-4",
  outputFormat: "portrait_1080x1920",
  width: 1080,
  height: 1920,
  minFontSize: 18,
  logos: {
    company: { path: "/brand/company-logo.svg", safeArea: 72 },
    administration: { path: "/brand/administration-mark.svg", safeArea: 72 }
  },
  slots: [
    "brand_header",
    "full_bleed_background",
    "title",
    "subtitle",
    "sessions",
    "audience",
    "activity_rules",
    "qr"
  ],
  overflowRules: {
    titleMaxLines: t01PortraitLayout.titleMaxLines,
    title: "block_export",
    body: "block_export"
  }
} as const;

type PosterRenderErrorCode =
  | "brand.font.load_failed"
  | "brand.mark.load_failed"
  | "brand.title.max_lines"
  | "content.capacity"
  | "brand.readability.contrast_failed"
  | "qr.asset.unavailable";

export class PosterRenderError extends Error {
  constructor(
    readonly code: PosterRenderErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "PosterRenderError";
  }
}

export type EmployeeActivityRenderResult = {
  outputPath: string;
  readability: T01ReadabilityReport;
};

export type EmployeeActivityRenderOptions = {
  readabilityMode?: "strict" | "trial";
  qrDataUri?: string;
};

const layoutReferenceBackgroundPath = path.join(
  process.cwd(),
  "public",
  "brand",
  "employee-activity-fallback.svg"
);

/**
 * Runs the same font/asset/layout checks as the renderer without creating an
 * output file. Call this before an image-model request so an impossible T01
 * document never consumes an image call.
 */
export async function preflightEmployeeActivity(
  document: PosterDocument,
  options: Pick<EmployeeActivityRenderOptions, "qrDataUri"> = {}
) {
  const [fallbackBytes, assets] = await Promise.all([
    readFile(layoutReferenceBackgroundPath),
    loadEmbeddedBrandAssets()
  ]);
  const fallbackData = dataUriForPath(layoutReferenceBackgroundPath, fallbackBytes);
  const qr = await qrDataUriForDocument(document, options.qrDataUri);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1
    });
    await page.addInitScript("globalThis.__name = (target) => target;");
    await page.goto("about:blank");
    await page.setContent(
      employeeActivityPosterMarkup(document, fallbackData, qr, assets),
      { waitUntil: "load" }
    );
    await assertRenderReadiness(page);
    await assertLayoutCapacity(page);
  } finally {
    await browser.close();
  }
}

export async function renderEmployeeActivity(
  document: PosterDocument,
  illustrationPath: string,
  jobId: string,
  options: EmployeeActivityRenderOptions = {}
): Promise<EmployeeActivityRenderResult> {
  const [imageBytes, assets] = await Promise.all([
    readFile(illustrationPath),
    loadEmbeddedBrandAssets()
  ]);
  const imageData = dataUriForPath(illustrationPath, imageBytes);
  const qr = await qrDataUriForDocument(document, options.qrDataUri);
  const outputPath = path.join(
    process.cwd(),
    "data",
    "generated",
    jobId + ".png"
  );
  await mkdir(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1
    });
    await page.addInitScript("globalThis.__name = (target) => target;");
    await page.goto("about:blank");
    await page.setContent(
      employeeActivityPosterMarkup(document, imageData, qr, assets),
      { waitUntil: "load" }
    );
    await assertRenderReadiness(page);
    await assertLayoutCapacity(page);

    const initialAnalysis = await analyzeBackground(page);
    // Keep an inspectable result even when neither tone passes. The worker
    // retries the visual first; after its bounded retries this warning render
    // is shown with download and regeneration actions.
    const treatments = selectT01Treatments(initialAnalysis) ??
      selectT01Treatments(initialAnalysis, { allowWarnings: true });
    if (!treatments) throw new PosterRenderError("brand.readability.contrast_failed", "无法分析主视觉的文字可读性。");
    const logoVariant = logoVariantForTreatment(treatments);
    await applyTextToneTreatment(
      page,
      treatments,
      logoVariant,
      assets.companyLogo,
      assets.companyLogoInverse
    );
    const finalAnalysis = await analyzeAppliedTreatment(page, treatments);
    const passed = finalAnalysis.every((region) =>
      region.candidates.every((candidate) => candidate.passed)
    );

    const readability: T01ReadabilityReport = {
      contractVersion: "t01-readability-v1",
      backgroundMode: "input",
      logoVariant,
      treatments,
      initialAnalysis,
      finalAnalysis,
      passed
    };
    await page.screenshot({ path: outputPath, type: "png" });
    return { outputPath, readability };
  } finally {
    await browser.close();
  }
}

async function qrDataUriForDocument(
  document: PosterDocument,
  uploadedQrDataUri?: string
) {
  if (!document.includeQr) return "";
  if (document.qrAssetId) {
    if (!uploadedQrDataUri) {
      throw new PosterRenderError(
        "qr.asset.unavailable",
        "二维码图片未准备完成，请重新上传后重试。"
      );
    }
    return uploadedQrDataUri;
  }
  if (document.qrPayload) {
    return QRCode.toDataURL(document.qrPayload, {
      width: 144,
      margin: 0,
      errorCorrectionLevel: "M"
    });
  }
  throw new PosterRenderError(
    "qr.asset.unavailable",
    "启用二维码后请提供链接或二维码图片。"
  );
}

async function assertRenderReadiness(page: Page) {
  const readiness = await page.evaluate(async () => {
    await window.document.fonts.ready;
    const miSansFaces = Array.from(window.document.fonts).filter(
      (face) => face.family.replaceAll('"', "") === "MiSans"
    );
    const logoImages = [
      window.document.querySelector<HTMLImageElement>(
        "[data-brand-company-logo]"
      ),
      window.document.querySelector<HTMLImageElement>(
        "[data-brand-administration-mark]"
      )
    ];
    return {
      miSansLoaded:
      miSansFaces.length === 3 &&
        miSansFaces.every((face) => face.status === "loaded") &&
        window.document.fonts.check('400 28px "MiSans"') &&
        window.document.fonts.check('600 28px "MiSans"') &&
        window.document.fonts.check('700 125px "MiSans"'),
      logosLoaded: logoImages.every(
        (image) => image?.complete && (image.naturalWidth ?? 0) > 0
      )
    };
  });
  if (!readiness.miSansLoaded) {
    throw new PosterRenderError(
      "brand.font.load_failed",
      "MiSans Regular、Medium 与 Bold 未完整加载，已阻止导出。"
    );
  }
  if (!readiness.logosLoaded) {
    throw new PosterRenderError(
      "brand.mark.load_failed",
      "公司 Logo 或行政标识未加载，已阻止导出。"
    );
  }
}

async function assertLayoutCapacity(page: Page) {
  const layout = await page.evaluate(
    ({
      titleTop,
      titleAreaBottom,
      titleSubtitleGap,
      infoBottom
    }) => {
    const title = window.document.querySelector<HTMLElement>(
      "[data-poster-title]"
    );
    const subtitle = window.document.querySelector<HTMLElement>(
      "[data-poster-subtitle]"
    );
    const titleBox = title?.getBoundingClientRect();
    const subtitleBox = subtitle?.getBoundingClientRect();
    const overflows = [
      "[data-poster-subtitle]",
      "[data-poster-session-time]",
      "[data-poster-session-location]",
      "[data-poster-audience]",
      "[data-poster-participation]"
    ].map((selector) => {
      const element = window.document.querySelector<HTMLElement>(selector);
      if (!element && selector === "[data-poster-subtitle]") return false;
      return (
        !element ||
        element.scrollHeight > element.clientHeight + 2 ||
        element.scrollWidth > element.clientWidth + 2
      );
    });
    const infoStack = window.document.querySelector<HTMLElement>("[data-t01-info-stack]");
    const qr = window.document.querySelector<HTMLElement>("[data-poster-qr]");
    const infoElements = Array.from(
      window.document.querySelectorAll<HTMLElement>(
        "[data-t01-info-stack] .session-detail, [data-t01-info-stack] .audience-group, [data-t01-info-stack] .participation-group"
      )
    );
    const overlaps = (left: DOMRect, right: DOMRect) =>
      left.left < right.right &&
      left.right > right.left &&
      left.top < right.bottom &&
      left.bottom > right.top;
    return {
      titleOverflow: !title || title.scrollWidth > title.clientWidth + 2,
      subtitleOverflow:
        Boolean(subtitle) &&
        subtitle!.scrollWidth > subtitle!.clientWidth + 2,
      titleAreaOverflow:
        Boolean((subtitleBox ?? titleBox) && (subtitleBox ?? titleBox)!.bottom > titleAreaBottom) ||
        Boolean(titleBox && titleBox.top < titleTop),
      titleSubtitleGapInvalid: Boolean(
        subtitle &&
          titleBox &&
          Math.abs(subtitleBox!.top - titleBox.bottom - titleSubtitleGap) > 1
      ),
      infoStackOverflow: Boolean(
        infoStack && infoStack.getBoundingClientRect().bottom > infoBottom
      ),
      qrCollision: Boolean(
        qr &&
          infoElements.some((element) =>
            overlaps(element.getBoundingClientRect(), qr.getBoundingClientRect())
          )
      ),
      contentOverflow: overflows.some(Boolean)
    };
    },
    {
      titleTop: t01PortraitLayout.titleTop,
      titleAreaBottom: t01PortraitLayout.titleAreaBottom,
      titleSubtitleGap: t01PortraitLayout.titleSubtitleGap,
      infoBottom: t01PortraitLayout.infoBottom
    }
  );
  if (layout.titleOverflow) {
    throw new PosterRenderError(
      "brand.title.max_lines",
      "标题超过 T01 竖版文本槽宽度，未生成海报。"
    );
  }
  if (layout.subtitleOverflow) {
    throw new PosterRenderError(
      "content.capacity",
      "副标题超过 T01 竖版文本槽宽度，未生成海报。"
    );
  }
  if (layout.titleAreaOverflow || layout.titleSubtitleGapInvalid) {
    throw new PosterRenderError(
      "content.capacity",
      "T01 标题组超过 y=1196 的安全边界或间距不符合模板契约，未生成海报。"
    );
  }
  if (layout.infoStackOverflow || layout.qrCollision) {
    throw new PosterRenderError(
      "content.capacity",
      "时间、地点、参与对象或活动规则超过 T01 信息区安全范围，未生成海报。"
    );
  }
  if (layout.contentOverflow) {
    throw new PosterRenderError(
      "content.capacity",
      "当前文案超过 T01 已声明槽位容量，未生成可能裁切的海报。"
    );
  }
}

async function analyzeBackground(page: Page): Promise<T01RegionAnalysis[]> {
  return page
    .evaluate(
      ({ regions }) => {
        type Region = (typeof regions)[number];
        const image = document.querySelector<HTMLImageElement>(".background");
        if (!image || !image.naturalWidth || !image.naturalHeight) {
          throw new Error("背景图片未加载");
        }
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1920;
        const context = canvas.getContext("2d", {
          willReadFrequently: true
        });
        if (!context) throw new Error("无法创建背景分析画布");
        const scale = Math.max(
          canvas.width / image.naturalWidth,
          canvas.height / image.naturalHeight
        );
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(
          image,
          (canvas.width - width) / 2,
          (canvas.height - height) / 2,
          width,
          height
        );
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
          .data;
        const linear = (channel: number) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (red: number, green: number, blue: number) =>
          0.2126 * linear(red) +
          0.7152 * linear(green) +
          0.0722 * linear(blue);
        const contrast = (left: number, right: number) =>
          (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
        const darkLuminance = luminance(72, 72, 74);
        const sampledLuminance = (x: number, y: number) => {
          const offset =
            (Math.min(canvas.height - 1, Math.max(0, Math.round(y))) *
              canvas.width +
              Math.min(canvas.width - 1, Math.max(0, Math.round(x)))) *
            4;
          return luminance(
            pixels[offset],
            pixels[offset + 1],
            pixels[offset + 2]
          );
        };
        const textRects = (region: Region) => {
          const selectors: Record<string, string[]> = {
            hero: [
              "[data-brand-company-logo]",
              ".hero-divider",
              ".hero-eyebrow",
              "[data-poster-title]",
              "[data-poster-subtitle]"
            ],
          sessions: [
              "[data-readability-region=\"sessions\"] h2",
              "[data-poster-session-time]",
              "[data-poster-session-location]"
            ],
            audience: [
              "[data-readability-region=\"audience\"] h2",
              "[data-poster-audience]"
            ],
            participation: [
              "[data-readability-region=\"participation\"] h2",
              "[data-poster-participation]"
            ],
            qr: [".qr-region p"]
          };
          const rects = (selectors[region.id] ?? []).flatMap((selector) =>
            Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap(
              (element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                const lines = Array.from(range.getClientRects());
                const boxes = lines.length ? lines : [element.getBoundingClientRect()];
                return boxes.map((box) => ({
                  x: Math.max(0, Math.floor(box.left)),
                  y: Math.max(0, Math.floor(box.top)),
                  width: Math.min(1080, Math.ceil(box.right)) - Math.max(0, Math.floor(box.left)),
                  height: Math.min(1920, Math.ceil(box.bottom)) - Math.max(0, Math.floor(box.top))
                }));
              }
            )
          );
          return rects.length ? rects : [region.bounds];
        };
        const summarize = (
          region: Region,
          treatment:
            | "dark_text_clean"
            | "light_text_clean"
        ) => {
          const samples: number[] = [];
          const values: number[] = [];
          let edges = 0;
          let edgeTotal = 0;
          for (const rect of textRects(region)) {
            for (let y = rect.y; y < rect.y + rect.height; y += 4) {
              for (let x = rect.x; x < rect.x + rect.width; x += 4) {
              const raw = sampledLuminance(x, y);
              const value = raw;
              values.push(value);
              samples.push(
                contrast(
                  value,
                  treatment === "light_text_clean" ? 1 : darkLuminance
                )
              );
              if (
                x + 4 < rect.x + rect.width &&
                y + 4 < rect.y + rect.height
              ) {
                edgeTotal += 2;
                if (Math.abs(raw - sampledLuminance(x + 4, y)) > 0.08) {
                  edges += 1;
                }
                if (Math.abs(raw - sampledLuminance(x, y + 4)) > 0.08) {
                  edges += 1;
                }
              }
              }
            }
          }
          samples.sort((left, right) => left - right);
          values.sort((left, right) => left - right);
          const percentile = (items: number[], position: number) =>
            items[Math.floor((items.length - 1) * position)] ?? 0;
          const passRate =
            samples.filter((item) => item >= region.minimumContrast).length /
            samples.length;
          return {
            passRate,
            p05Contrast: percentile(samples, 0.05),
            minimumContrast: region.minimumContrast,
            passed:
              passRate >= 0.95 &&
              percentile(samples, 0.05) >= region.minimumContrast,
            luminance: {
              p05: percentile(values, 0.05),
              p50: percentile(values, 0.5),
              p95: percentile(values, 0.95)
            },
            edgeDensity: edgeTotal ? edges / edgeTotal : 0
          };
        };
        return regions.map((region) => {
          const clean = summarize(region, "dark_text_clean");
          const candidates = [
            {
              treatment: "dark_text_clean" as const,
              scrimStrength: 0,
              ...clean
            },
            {
              treatment: "light_text_clean" as const,
              scrimStrength: 0,
              ...summarize(region, "light_text_clean")
            }
          ];
          return {
            id: region.id,
            bounds: region.bounds,
            luminance: clean.luminance,
            edgeDensity: clean.edgeDensity,
            candidates
          };
        });
      },
      { regions: T01_READABILITY_REGIONS }
    )
    .then(
      (analysis): T01RegionAnalysis[] =>
        analysis.map((region) => ({
          id: region.id as T01RegionAnalysis["id"],
          bounds: region.bounds,
          luminance: region.luminance,
          edgeDensity: region.edgeDensity,
          candidates: region.candidates.map((candidate) => {
            const measurement: T01CandidateMeasurement = {
              treatment: candidate.treatment,
              scrimStrength: candidate.scrimStrength as T01CandidateMeasurement["scrimStrength"],
              passRate: candidate.passRate,
              p05Contrast: candidate.p05Contrast,
              minimumContrast: candidate.minimumContrast,
              passed: candidate.passed
            };
            return {
              ...measurement,
              passed: contrastPasses(measurement)
            };
          })
        }))
    );
}

async function applyTextToneTreatment(
  page: Page,
  treatments: Record<string, T01ZoneTreatment>,
  logoVariant: "primary" | "inverse",
  primaryLogo: string,
  inverseLogo: string
) {
  await page.evaluate(
    ({ selected, variant, companyLogo }) => {
      Object.entries(selected).forEach(([region, treatment]) => {
        const target = document.querySelector<HTMLElement>(
          "[data-readability-region=\"" + region + "\"]"
        );
        if (target) target.dataset.textTone = treatment.textTone;
      });
      const company = document.querySelector<HTMLImageElement>(
        "[data-brand-company-logo]"
      );
      if (company) {
        company.src = companyLogo;
        company.dataset.logoVariant = variant;
      }
    },
    {
      selected: treatments,
      variant: logoVariant,
      companyLogo: logoVariant === "inverse" ? inverseLogo : primaryLogo
    }
  );
  await page.waitForFunction(() => {
    const company = document.querySelector<HTMLImageElement>(
      "[data-brand-company-logo]"
    );
    return Boolean(company?.complete && (company.naturalWidth ?? 0) > 0);
  });
}

async function analyzeAppliedTreatment(
  page: Page,
  treatments: Record<string, T01ZoneTreatment>
): Promise<T01RegionAnalysis[]> {
  return page.evaluate(
    ({ regions, selected }) => {
      const image = document.querySelector<HTMLImageElement>(".background");
      if (!image || !image.naturalWidth || !image.naturalHeight) {
        throw new Error("背景图片未加载");
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext("2d", {
        willReadFrequently: true
      });
      if (!context) throw new Error("无法创建背景分析画布");
      const scale = Math.max(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight
      );
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(
        image,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height
      );
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
        .data;
      const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (red: number, green: number, blue: number) =>
        0.2126 * linear(red) +
        0.7152 * linear(green) +
        0.0722 * linear(blue);
      const contrast = (left: number, right: number) =>
        (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
      const raw = (x: number, y: number) => {
        const offset =
          (Math.min(canvas.height - 1, Math.max(0, Math.round(y))) *
            canvas.width +
            Math.min(canvas.width - 1, Math.max(0, Math.round(x)))) *
          4;
        return luminance(
          pixels[offset],
          pixels[offset + 1],
          pixels[offset + 2]
        );
      };
      const textRects = (region: (typeof regions)[number]) => {
        const selectors: Record<string, string[]> = {
          hero: [
            "[data-brand-company-logo]",
            ".hero-divider",
            ".hero-eyebrow",
            "[data-poster-title]",
            "[data-poster-subtitle]"
          ],
          sessions: [
            "[data-readability-region=\"sessions\"] h2",
            "[data-poster-session-time]",
            "[data-poster-session-location]"
          ],
          audience: [
            "[data-readability-region=\"audience\"] h2",
            "[data-poster-audience]"
          ],
          participation: [
            "[data-readability-region=\"participation\"] h2",
            "[data-poster-participation]"
          ],
          qr: [".qr-region p"]
        };
        const rects = (selectors[region.id] ?? []).flatMap((selector) =>
          Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap(
            (element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              const lines = Array.from(range.getClientRects());
              const boxes = lines.length ? lines : [element.getBoundingClientRect()];
              return boxes.map((box) => ({
                x: Math.max(0, Math.floor(box.left)),
                y: Math.max(0, Math.floor(box.top)),
                width: Math.min(1080, Math.ceil(box.right)) - Math.max(0, Math.floor(box.left)),
                height: Math.min(1920, Math.ceil(box.bottom)) - Math.max(0, Math.floor(box.top))
              }));
            }
          )
        );
        return rects.length ? rects : [region.bounds];
      };
      return regions.map((region) => {
        const treatment = selected[region.id];
        const contrasts: number[] = [];
        const luminances: number[] = [];
        let edges = 0;
        let edgeTotal = 0;
        for (const rect of textRects(region)) {
          for (let y = rect.y; y < rect.y + rect.height; y += 4) {
            for (let x = rect.x; x < rect.x + rect.width; x += 4) {
            const value = raw(x, y);
            luminances.push(value);
            contrasts.push(
              contrast(
                value,
                treatment.textTone === "light" ? 1 : luminance(72, 72, 74)
              )
            );
            if (
              x + 4 < rect.x + rect.width &&
              y + 4 < rect.y + rect.height
            ) {
              edgeTotal += 2;
              if (Math.abs(value - raw(x + 4, y)) > 0.08) edges += 1;
              if (Math.abs(value - raw(x, y + 4)) > 0.08) edges += 1;
            }
          }
        }
        }
        contrasts.sort((left, right) => left - right);
        luminances.sort((left, right) => left - right);
        const percentile = (items: number[], position: number) =>
          items[Math.floor((items.length - 1) * position)] ?? 0;
        const passRate =
          contrasts.filter((item) => item >= region.minimumContrast).length /
          contrasts.length;
        return {
          id: region.id,
          bounds: region.bounds,
          luminance: {
            p05: percentile(luminances, 0.05),
            p50: percentile(luminances, 0.5),
            p95: percentile(luminances, 0.95)
          },
          edgeDensity: edgeTotal ? edges / edgeTotal : 0,
          candidates: [
            {
              treatment: treatment.treatment,
              scrimStrength: treatment.scrimStrength,
              passRate,
              p05Contrast: percentile(contrasts, 0.05),
              minimumContrast: region.minimumContrast,
              passed:
                passRate >= 0.95 &&
                percentile(contrasts, 0.05) >= region.minimumContrast
            }
          ]
        };
      });
    },
    { regions: T01_READABILITY_REGIONS, selected: treatments }
  );
}

function dataUriForPath(filePath: string, bytes: Buffer) {
  return (
    "data:" + mimeTypeForPath(filePath) + ";base64," + bytes.toString("base64")
  );
}

function mimeTypeForPath(filePath: string) {
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (filePath.endsWith(".webp")) return "image/webp";
  return "image/png";
}

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char
  );
}

function chineseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? match[1] + "年" + Number(match[2]) + "月" + Number(match[3]) + "日"
    : value;
}

function sessionTimesMarkup(document: PosterDocument) {
  return document.sessions
    .map(
      (session) =>
        "<p>" +
        chineseDate(session.date) +
        (session.time ? " " + escape(session.time) : "") +
        "</p>"
    )
    .join("");
}

function sessionLocationsMarkup(document: PosterDocument) {
  return document.sessions
    .map(
      (session) =>
        "<p>" + escape(session.location) + "</p>"
    )
    .join("");
}

function participationMarkup(document: PosterDocument) {
  return document.participationSteps
    .map((step) => "<p>" + escape(step) + "</p>")
    .join("");
}

export function employeeActivityPosterMarkup(
  document: PosterDocument,
  image: string,
  qr: string,
  assets: Awaited<ReturnType<typeof loadEmbeddedBrandAssets>>
) {
  const qrMarkup = qr
    ? '<aside class="qr-region" data-poster-qr><img class="qr" src="' +
      qr +
      '" alt="活动二维码"><p>' +
      escape(document.ctaLabel || "扫码报名") +
      "</p></aside>"
    : "";
  const styles = [
    assets.fontFaceCss,
    '* { box-sizing: border-box; } html, body { width: 1080px; height: 1920px; margin: 0; } body { color: #1C1C1E; font-family: "MiSans", sans-serif; }',
    ".poster { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #fff; } .background { position: absolute; inset: 0 0 660px; width: 100%; height: 1260px; object-fit: cover; object-position: center; } .info-panel { position:absolute; z-index:1; top:1260px; width:1080px; height:660px; background:#F2F2EE; }",
    ".hero-content { position:absolute; z-index:2; inset:0; } .brand-header { position:absolute; top:64px; left:64px; right:64px; height:66.014px; display:flex; align-items:center; justify-content:space-between; } .company-logo { width:224px; height:66.014px; object-fit:contain; object-position:left center; } .administration-mark { width:61.2px; height:61.2px; object-fit:contain; } .hero-divider { position:absolute; top:184px; left:64px; width:952px; height:2px; background:#151515; } .hero-eyebrow { position:absolute; top:222px; left:64px; margin:0; color:#151515; font-size:26px; font-weight:600; line-height:32.5px; } .title-region { position:absolute; top:292px; left:64px; width:952px; display:flex; flex-direction:column; gap:22px; } .title { width:952px; margin:0; color:#151515; font-size:125px; font-weight:700; line-height:166px; line-break:strict; word-break:normal; overflow-wrap:break-word; text-wrap:balance; } .subtitle { width:952px; margin:0; color:#151515; font-size:28px; font-weight:600; line-height:35px; line-break:strict; word-break:normal; overflow-wrap:break-word; text-wrap:pretty; } .hero-content[data-text-tone=\"light\"] .hero-divider { background:#fff; } .hero-content[data-text-tone=\"light\"] .hero-eyebrow, .hero-content[data-text-tone=\"light\"] .title, .hero-content[data-text-tone=\"light\"] .subtitle { color:#fff; }",
    ".info-stack { position:absolute; z-index:2; top:1298px; left:64px; width:952px; height:520px; color:#181818; } .info-kicker { position:absolute; top:0; left:0; height:37px; padding:5px 10px; color:#F2F2EE; background:#181818; font-size:21px; font-weight:700; line-height:25.2px; } .info-heading { position:absolute; top:63px; left:0; margin:0; font-size:52px; font-weight:800; line-height:62.4px; } .info-rule { position:absolute; left:0; height:1px; background:#C8C8C1; } .info-rule.top { top:151px; width:952px; } .info-rule.mid { top:306px; width:726px; } .info-rule.bottom { top:480px; width:952px; } .info-rule.vertical { top:151px; width:1px; height:329px; } .info-rule.v1 { left:373px; } .info-rule.v2 { left:750px; } .info-group { position:absolute; top:177px; } .session-time { left:0; width:349px; } .session-location { left:400px; width:320px; } .audience-group { top:336px; left:0; width:349px; } .participation-group { top:336px; left:400px; width:320px; } .info-group h2 { display:flex; gap:14px; align-items:flex-start; margin:0 0 17px; font-size:23px; font-weight:700; line-height:27.6px; } .info-group h2::before { color:#75756F; font-size:20px; font-weight:600; line-height:24px; } .session-time h2::before { content:'01'; } .session-location h2::before { content:'02'; } .audience-group h2::before { content:'03'; } .participation-group h2::before { content:'04'; } .info-group .copy { margin:0; color:#181818; font-size:29px; font-weight:600; line-height:34.8px; overflow-wrap:break-word; } .session-location .copy { font-size:32px; line-height:38.4px; } .audience-group .copy { font-size:28px; line-height:33.6px; } .participation-group .copy { font-size:27px; line-height:32.4px; } .info-group .copy p { margin:0; } .info-note { position:absolute; top:499px; left:0; width:726px; margin:0; color:#75756F; font-size:22px; font-weight:400; line-height:26.4px; }",
    ".info-crosses { position:absolute; z-index:3; top:1298px; left:64px; width:952px; height:480px; pointer-events:none; } .cross { position:absolute; color:#75756F; font-family:Arial,sans-serif; font-size:32px; font-weight:400; line-height:32px; transform:translate(-50%,-50%); } .c1 { left:0; top:151px; } .c2 { left:373px; top:151px; } .c3 { left:750px; top:151px; } .c4 { left:952px; top:151px; } .c5 { left:0; top:480px; } .c6 { left:750px; top:480px; } .c7 { left:952px; top:480px; } .qr-region { position:absolute; z-index:3; top:1496px; left:850px; width:134px; } .qr { display:block; width:134px; height:134px; padding:0; border:1px solid #C8C8C1; background:#fff; object-fit:contain; } .qr-region p { margin:10px 0 0; color:#181818; font-size:20px; font-weight:400; line-height:24px; text-align:center; } .registration-cta { position:absolute; z-index:3; top:1304px; left:844px; display:flex; align-items:center; gap:6px; } .registration-cta span { display:block; height:37px; padding:5px 10px; color:#181818; background:#F7E600; font-size:21px; font-weight:700; line-height:25.2px; } .registration-cta img { width:34px; height:34px; }"
  ].join("");
  return [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>',
    styles,
    "</style></head><body><main class=\"poster\"><img class=\"background\" src=\"",
    image,
    '" alt="活动主视觉">',
    '<section class="hero-content" data-readability-region="hero">',
    brandHeaderMarkup(assets, "primary"),
    '<i class="hero-divider" aria-hidden="true"></i>',
    document.slogan ? '<p class="hero-eyebrow" data-poster-slogan>' + escape(document.slogan) + "</p>" : "",
    '<section class="title-region" style="top:' + (document.slogan ? "292" : "222") + 'px"><h1 class="title" data-poster-title>',
    escape(document.title),
    "</h1>",
    document.subtitle
      ? '<p class="subtitle" data-poster-subtitle>' +
        escape(document.subtitle) +
        "</p>"
      : "",
    "</section></section><div class=\"info-panel\"></div>",
    '<div class="info-stack" data-t01-info-stack><b class="info-kicker">活动指南</b><h2 class="info-heading">先看这里。</h2><i class="info-rule top"></i><i class="info-rule mid"></i><i class="info-rule bottom"></i><i class="info-rule vertical v1"></i><i class="info-rule vertical v2"></i><section class="info-group session-time"><h2>',
    "活动时间",
    '</h2><div class="copy" data-poster-session-time data-poster-sessions>',
    sessionTimesMarkup(document),
    '</div></section><section class="info-group session-location"><h2>',
    "活动地点",
    '</h2><div class="copy" data-poster-session-location>',
    sessionLocationsMarkup(document),
    "</div></section>",
    '<section class="info-group audience-group"><h2>参与对象</h2><p class="copy" data-poster-audience>',
    escape(document.audience),
    "</p></section>",
    '<section class="info-group participation-group"><h2>',
    "活动规则",
    '</h2><div class="copy" data-poster-participation>',
    participationMarkup(document),
    "</div></section><p class=\"info-note\">",
    escape(document.notice),
    "</p></div><div class=\"info-crosses\" aria-hidden=\"true\"><i class=\"cross c1\">+</i><i class=\"cross c2\">+</i><i class=\"cross c3\">+</i><i class=\"cross c4\">+</i><i class=\"cross c5\">+</i><i class=\"cross c6\">+</i><i class=\"cross c7\">+</i></div>",
    qr ? '<aside class="registration-cta"><span>一起参加</span><img src="' + assets.registrationArrow + '" alt=""></aside>' : "",
    qrMarkup,
    "</main></body></html>"
  ].join("");
}
