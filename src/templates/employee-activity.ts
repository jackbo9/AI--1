import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { chromium, type Page } from "playwright";
import type { PosterDocument } from "@/contracts/poster";
import { brandHeaderMarkup, loadEmbeddedBrandAssets } from "./brand-header";
import {
  T01_READABILITY_REGIONS,
  T01_SCRIM_STRENGTHS,
  contrastPasses,
  logoVariantForTreatment,
  selectT01Treatments,
  t01ScrimMasks,
  type T01CandidateMeasurement,
  type T01ReadabilityReport,
  type T01RegionAnalysis,
  type T01ZoneTreatment
} from "./t01-readability";

export const employeeActivityTemplate = {
  id: "employee-activity-portrait",
  version: "1.2.0-t01-readability",
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
    "participation",
    "qr",
    "footer"
  ],
  overflowRules: {
    titleMaxLines: 1,
    title: "block_export",
    body: "block_export"
  }
} as const;

type PosterRenderErrorCode =
  | "brand.font.load_failed"
  | "brand.mark.load_failed"
  | "brand.title.max_lines"
  | "content.capacity"
  | "brand.readability.contrast_failed";

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
};

const fallbackPath = path.join(
  process.cwd(),
  "public",
  "brand",
  "employee-activity-fallback.svg"
);

export async function renderEmployeeActivity(
  document: PosterDocument,
  illustrationPath: string,
  jobId: string,
  options: EmployeeActivityRenderOptions = {}
): Promise<EmployeeActivityRenderResult> {
  const [imageBytes, fallbackBytes, assets] = await Promise.all([
    readFile(illustrationPath),
    readFile(fallbackPath),
    loadEmbeddedBrandAssets()
  ]);
  const imageData = dataUriForPath(illustrationPath, imageBytes);
  const fallbackData = dataUriForPath(fallbackPath, fallbackBytes);
  const qr =
    document.includeQr && document.qrPayload
      ? await QRCode.toDataURL(document.qrPayload, {
          width: 144,
          margin: 0,
          errorCorrectionLevel: "M"
        })
      : "";
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
    const readabilityMode = options.readabilityMode ?? "strict";
    let treatments = selectT01Treatments(initialAnalysis, {
      allowWarnings: readabilityMode === "trial"
    });
    let backgroundMode: "input" | "fallback" = "input";
    let fallbackReason: "no_input_treatment_passed" | undefined;

    if (!treatments && readabilityMode === "strict") {
      if (illustrationPath === fallbackPath) {
        throw new PosterRenderError(
          "brand.readability.contrast_failed",
          "品牌降级背景仍无法满足 T01 对比度发布门，已阻止导出。"
        );
      }
      await replaceBackground(page, fallbackData);
      const fallbackAnalysis = await analyzeBackground(page);
      treatments = selectT01Treatments(fallbackAnalysis);
      backgroundMode = "fallback";
      fallbackReason = "no_input_treatment_passed";
      if (!treatments) {
        throw new PosterRenderError(
          "brand.readability.contrast_failed",
          "原图与品牌降级背景均无法满足 T01 对比度发布门，已阻止导出。"
        );
      }
    }

    if (!treatments) {
      throw new PosterRenderError(
        "brand.readability.contrast_failed",
        "T01 无法为文字区域选择可用的可读性处理。"
      );
    }
    const logoVariant = logoVariantForTreatment(treatments);
    const masks = t01ScrimMasks(treatments);
    await applyReadabilityTreatment(
      page,
      treatments,
      masks,
      logoVariant,
      assets.companyLogo,
      assets.companyLogoInverse
    );
    const finalAnalysis = await analyzeAppliedTreatment(page, treatments, masks);
    const passed = finalAnalysis.every((region) =>
      region.candidates.every((candidate) => candidate.passed)
    );
    if (!passed && readabilityMode === "strict") {
      throw new PosterRenderError(
        "brand.readability.contrast_failed",
        "局部柔性遮罩合成后仍未通过 T01 对比度发布门，已阻止导出。"
      );
    }

    const readability: T01ReadabilityReport = {
      contractVersion: "t01-readability-v1",
      backgroundMode,
      ...(fallbackReason ? { fallbackReason } : {}),
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
        miSansFaces.length === 2 &&
        miSansFaces.every((face) => face.status === "loaded") &&
        window.document.fonts.check('400 28px "MiSans"') &&
        window.document.fonts.check('600 120px "MiSans"'),
      logosLoaded: logoImages.every(
        (image) => image?.complete && (image.naturalWidth ?? 0) > 0
      )
    };
  });
  if (!readiness.miSansLoaded) {
    throw new PosterRenderError(
      "brand.font.load_failed",
      "MiSans 正常与半粗字重未完整加载，已阻止导出。"
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
  const layout = await page.evaluate(() => {
    const title = window.document.querySelector<HTMLElement>(
      "[data-poster-title]"
    );
    const range = window.document.createRange();
    if (title) range.selectNodeContents(title);
    const titleLineCount = new Set(
      Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))
    ).size;
    const overflows = [
      "[data-poster-subtitle]",
      "[data-poster-sessions]",
      "[data-poster-audience]",
      "[data-poster-participation]"
    ].map((selector) => {
      const element = window.document.querySelector<HTMLElement>(selector);
      return (
        !element ||
        element.scrollHeight > element.clientHeight + 2 ||
        element.scrollWidth > element.clientWidth + 2
      );
    });
    return {
      titleOverflow:
        !title ||
        titleLineCount > 1 ||
        title.scrollWidth > title.clientWidth + 2,
      contentOverflow: overflows.some(Boolean)
    };
  });
  if (layout.titleOverflow) {
    throw new PosterRenderError(
      "brand.title.max_lines",
      "标题超过 T01 竖版模板允许的一行，未生成可能遮挡说明区的海报。"
    );
  }
  if (layout.contentOverflow) {
    throw new PosterRenderError(
      "content.capacity",
      "当前文案超过 T01 已声明槽位容量，未生成可能裁切的海报。"
    );
  }
}

async function replaceBackground(page: Page, source: string) {
  await page
    .locator(".background")
    .evaluate((element, nextSource) => {
      const image = element as HTMLImageElement;
      image.src = nextSource;
    }, source);
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(".background");
    return Boolean(image?.complete && (image.naturalWidth ?? 0) > 0);
  });
}

async function analyzeBackground(page: Page): Promise<T01RegionAnalysis[]> {
  return page
    .evaluate(
      ({ regions, strengths }) => {
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
        const clamp = (value: number) => Math.min(1, Math.max(0, value));
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
        const profile = (x: number, y: number, region: Region) => {
          const centerX = region.bounds.x + region.bounds.width / 2;
          const centerY = region.bounds.y + region.bounds.height / 2;
          const normalizedX =
            Math.abs(x - centerX) / (region.bounds.width / 2 + 360);
          const normalizedY =
            Math.abs(y - centerY) / (region.bounds.height / 2 + 120);
          const distance = Math.max(normalizedX, normalizedY);
          return distance <= 0.64 ? 1 : clamp((1 - distance) / 0.36);
        };
        const textRects = (region: Region) => {
          const selectors: Record<string, string[]> = {
            header: [
              "[data-brand-company-logo]",
              "[data-brand-administration-mark]"
            ],
            title: ["[data-poster-title]", "[data-poster-subtitle]"],
            sessions: [
              "[data-readability-region=\"sessions\"] h2",
              "[data-poster-sessions]"
            ],
            audience: [
              "[data-readability-region=\"audience\"] h2",
              "[data-poster-audience]"
            ],
            participation: [
              "[data-readability-region=\"participation\"] h2",
              "[data-poster-participation]"
            ],
            qr: [".qr-region p"],
            footer: [".footer p"]
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
            | "dark_text_light_scrim"
            | "light_text_dark_scrim",
          strength: number
        ) => {
          const samples: number[] = [];
          const values: number[] = [];
          let edges = 0;
          let edgeTotal = 0;
          for (const rect of textRects(region)) {
            for (let y = rect.y; y < rect.y + rect.height; y += 4) {
              for (let x = rect.x; x < rect.x + rect.width; x += 4) {
              const raw = sampledLuminance(x, y);
              const alpha = strength * profile(x, y, region);
              const value =
                treatment === "dark_text_light_scrim"
                  ? raw * (1 - alpha) + alpha
                  : treatment === "light_text_dark_scrim"
                    ? raw * (1 - alpha)
                    : raw;
              values.push(value);
              samples.push(
                contrast(
                  value,
                  treatment === "light_text_dark_scrim" ? 1 : darkLuminance
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
          const clean = summarize(region, "dark_text_clean", 0);
          const candidates = [
            {
              treatment: "dark_text_clean" as const,
              scrimStrength: 0,
              ...clean
            },
            ...strengths
              .filter((strength) => strength > 0)
              .map((strength) => ({
                treatment: "dark_text_light_scrim" as const,
                scrimStrength: strength,
                ...summarize(region, "dark_text_light_scrim", strength)
              })),
            ...strengths.map((strength) => ({
              treatment: "light_text_dark_scrim" as const,
              scrimStrength: strength,
              ...summarize(region, "light_text_dark_scrim", strength)
            }))
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
      { regions: T01_READABILITY_REGIONS, strengths: T01_SCRIM_STRENGTHS }
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

async function applyReadabilityTreatment(
  page: Page,
  treatments: Record<string, T01ZoneTreatment>,
  masks: { treatment: T01ZoneTreatment["treatment"]; scrimStrength: number; bounds: T01ZoneTreatment["bounds"] }[],
  logoVariant: "primary" | "inverse",
  primaryLogo: string,
  inverseLogo: string
) {
  await page.evaluate(
    ({ selected, masks, variant, companyLogo }) => {
      document
        .querySelectorAll("[data-readability-scrim]")
        .forEach((element) => element.remove());
      Object.entries(selected).forEach(([region, treatment]) => {
        const target = document.querySelector<HTMLElement>(
          "[data-readability-region=\"" + region + "\"]"
        );
        if (target) target.dataset.textTone = treatment.textTone;
      });
      masks.forEach((treatment, index) => {
        const scrim = document.createElement("div");
        scrim.dataset.readabilityScrim = String(index);
        scrim.className =
          "readability-scrim readability-scrim-" + treatment.treatment;
        scrim.style.left = treatment.bounds.x - 360 + "px";
        scrim.style.top = treatment.bounds.y - 120 + "px";
        scrim.style.width = treatment.bounds.width + 720 + "px";
        scrim.style.height = treatment.bounds.height + 240 + "px";
        scrim.style.setProperty(
          "--scrim-strength",
          String(treatment.scrimStrength)
        );
        scrim.style.setProperty(
          "--scrim-soft-strength",
          String(treatment.scrimStrength / 2)
        );
        document.querySelector(".poster")?.append(scrim);
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
      masks,
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
  treatments: Record<string, T01ZoneTreatment>,
  masks: { treatment: T01ZoneTreatment["treatment"]; scrimStrength: number; bounds: T01ZoneTreatment["bounds"] }[]
): Promise<T01RegionAnalysis[]> {
  return page.evaluate(
    ({ regions, selected, masks }) => {
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
      const clamp = (value: number) => Math.min(1, Math.max(0, value));
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
      const profile = (
        x: number,
        y: number,
        treatment: { bounds: { x: number; y: number; width: number; height: number } }
      ) => {
        const centerX = treatment.bounds.x + treatment.bounds.width / 2;
        const centerY = treatment.bounds.y + treatment.bounds.height / 2;
        const distance = Math.max(
          Math.abs(x - centerX) / (treatment.bounds.width / 2 + 360),
          Math.abs(y - centerY) / (treatment.bounds.height / 2 + 120)
        );
        return distance <= 0.64 ? 1 : clamp((1 - distance) / 0.36);
      };
      const composite = (x: number, y: number) =>
        masks.reduce((value, treatment) => {
          if (!treatment.scrimStrength) return value;
          const alpha =
            treatment.scrimStrength * profile(x, y, treatment);
          return treatment.treatment === "dark_text_light_scrim"
            ? value * (1 - alpha) + alpha
            : value * (1 - alpha);
        }, raw(x, y));
      const textRects = (region: (typeof regions)[number]) => {
        const selectors: Record<string, string[]> = {
          header: [
            "[data-brand-company-logo]",
            "[data-brand-administration-mark]"
          ],
          title: ["[data-poster-title]", "[data-poster-subtitle]"],
          sessions: [
            "[data-readability-region=\"sessions\"] h2",
            "[data-poster-sessions]"
          ],
          audience: [
            "[data-readability-region=\"audience\"] h2",
            "[data-poster-audience]"
          ],
          participation: [
            "[data-readability-region=\"participation\"] h2",
            "[data-poster-participation]"
          ],
          qr: [".qr-region p"],
          footer: [".footer p"]
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
            const value = composite(x, y);
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
              if (Math.abs(value - composite(x + 4, y)) > 0.08) edges += 1;
              if (Math.abs(value - composite(x, y + 4)) > 0.08) edges += 1;
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
    { regions: T01_READABILITY_REGIONS, selected: treatments, masks }
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

function sessionsMarkup(document: PosterDocument) {
  return document.sessions
    .map(
      (session) =>
        "<p>" +
        escape(session.label) +
        "｜" +
        chineseDate(session.date) +
        " " +
        escape(session.time) +
        "｜" +
        escape(session.location) +
        "</p>"
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
    ? '<aside class="qr-region" data-readability-region="qr" data-poster-qr><img class="qr" src="' +
      qr +
      '" alt="活动二维码"><p>' +
      escape(document.ctaLabel || "扫码参与") +
      "</p></aside>"
    : "";
  const participationTitle =
    document.category === "competition" ? "赛事规则" : "参与方式";
  const styles = [
    assets.fontFaceCss,
    '* { box-sizing: border-box; } html, body { width: 1080px; height: 1920px; margin: 0; } body { color: #1C1C1E; font-family: "MiSans", sans-serif; }',
    ".poster { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #F5F5F2; } .background { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }",
    ".readability-scrim { position: absolute; z-index: 1; pointer-events: none; background: radial-gradient(ellipse at center, rgb(var(--scrim-color) / var(--scrim-strength)) 0%, rgb(var(--scrim-color) / var(--scrim-strength)) 64%, rgb(var(--scrim-color) / var(--scrim-soft-strength)) 82%, rgb(var(--scrim-color) / 0) 100%); } .readability-scrim-dark_text_light_scrim { --scrim-color: 255 255 255; } .readability-scrim-light_text_dark_scrim { --scrim-color: 0 0 0; }",
    ".brand-header { position: absolute; z-index: 2; top: 80px; left: 72px; right: 72px; height: 82.5179px; display: flex; align-items: center; justify-content: space-between; } .company-logo { width: 280px; height: 82.5179px; object-fit: contain; object-position: left center; } .administration-mark { width: 76.5001px; height: 76.5001px; object-fit: contain; }",
    ".title-region { position: absolute; z-index: 2; left: 81px; top: 223px; width: 720px; } .title { width: 690px; height: 144px; margin: 0; overflow: hidden; color: #1C1C1E; font-size: 120px; font-weight: 600; line-height: 1.2; line-break: strict; word-break: normal; overflow-wrap: break-word; text-wrap: balance; } .subtitle { width: 720px; height: 82px; margin: 25px 0 0; overflow: hidden; color: #000; font-size: 28px; font-weight: 400; line-height: 1.45; line-break: strict; word-break: normal; overflow-wrap: break-word; text-wrap: pretty; } .title-region[data-text-tone=\"light\"] .title, .title-region[data-text-tone=\"light\"] .subtitle { color: #FFF; }",
    ".info-group { position: absolute; z-index: 2; left: 72px; width: 936px; color: #1C1C1E; } .info-group h2 { height: 34px; margin: 0 0 8px; font-size: 28px; font-weight: 600; line-height: 1.2; } .info-group .copy { margin: 0; overflow: hidden; color: #48484A; font-size: 22px; font-weight: 400; line-height: 1.4; line-break: strict; word-break: normal; overflow-wrap: break-word; text-wrap: pretty; } .info-group .copy p { margin: 0; } .info-group[data-text-tone=\"light\"] { color: #FFF; } .info-group[data-text-tone=\"light\"] .copy { color: #FFF; }",
    ".sessions-group { top: 1366px; height: 103px; } .sessions-group .copy { height: 61px; } .audience-group { top: 1477px; height: 103px; } .audience-group .copy { height: 31px; white-space: nowrap; } .participation-group { top: 1588px; height: 158px; } .participation-group .copy { height: 124px; } .participation-group.with-qr { width: 717px; }",
    ".qr-region { position: absolute; z-index: 2; left: 864px; top: 1574px; width: 144px; } .qr { display: block; width: 144px; height: 144px; border-radius: 16px; background: #F5F5F2; } .qr-region p { margin: 14px 0 0; color: #48484A; font-size: 18px; font-weight: 400; line-height: 1.4; text-align: center; } .qr-region[data-text-tone=\"light\"] p { color: #FFF; }",
    ".footer { position: absolute; z-index: 2; right: 72px; bottom: 80px; left: 72px; display: flex; justify-content: space-between; color: #48484A; font-size: 18px; font-weight: 400; line-height: 1.4; } .footer[data-text-tone=\"light\"] { color: #FFF; } .footer p { margin: 0; white-space: nowrap; }"
  ].join("");
  return [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>',
    styles,
    "</style></head><body><main class=\"poster\"><img class=\"background\" src=\"",
    image,
    '" alt="活动主视觉">',
    brandHeaderMarkup(assets, "primary"),
    '<section class="title-region" data-readability-region="title"><h1 class="title" data-poster-title>',
    escape(document.title),
    '</h1><p class="subtitle" data-poster-subtitle>',
    escape(document.subtitle || document.summary),
    "</p></section>",
    '<section class="info-group sessions-group" data-readability-region="sessions"><h2>活动时间/地点</h2><div class="copy" data-poster-sessions>',
    sessionsMarkup(document),
    "</div></section>",
    '<section class="info-group audience-group" data-readability-region="audience"><h2>参与对象</h2><p class="copy" data-poster-audience>',
    escape(document.audience),
    "</p></section>",
    '<section class="info-group participation-group',
    qr ? " with-qr" : "",
    '" data-readability-region="participation"><h2>',
    participationTitle,
    '</h2><div class="copy" data-poster-participation>',
    participationMarkup(document),
    "</div></section>",
    qrMarkup,
    '<footer class="footer" data-readability-region="footer"><p>九号行政｜ADMINISTRATION</p><p>员工活动 / ACTIVITY</p></footer></main></body></html>'
  ].join("");
}
