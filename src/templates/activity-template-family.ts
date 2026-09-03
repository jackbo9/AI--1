import { z } from "zod";
import {
  brandSpecVersionSchema,
  renderTargetIdSchema
} from "@/contracts/brand";

const pixelInsetsSchema = z.object({
  top: z.number().nonnegative(),
  right: z.number().nonnegative(),
  bottom: z.number().nonnegative(),
  left: z.number().nonnegative()
});

const pixelRectSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive()
});

const normalizedRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1)
  })
  .refine((rect) => rect.x + rect.width <= 1, {
    message: "焦点区不能超出画布宽度"
  })
  .refine((rect) => rect.y + rect.height <= 1, {
    message: "焦点区不能超出画布高度"
  });

const fixedDimensionsSchema = z.object({
  width: z.number().int().positive(),
  heightMode: z.literal("fixed"),
  height: z.number().int().positive()
});

const autoDimensionsSchema = z.object({
  width: z.number().int().positive(),
  heightMode: z.literal("auto"),
  minHeight: z.number().int().positive(),
  maxHeight: z.number().int().positive()
});

export const activityModuleSchema = z.enum([
  "brand_header",
  "title",
  "subtitle",
  "summary",
  "primary_session",
  "all_sessions",
  "highlights",
  "participation",
  "notice",
  "cta",
  "qr",
  "footer"
]);

export const renderTargetManifestSchema = z.object({
  id: renderTargetIdSchema,
  templateId: z.string().min(1),
  templateVersion: z.string().min(1),
  dimensions: z.discriminatedUnion("heightMode", [
    fixedDimensionsSchema,
    autoDimensionsSchema
  ]),
  safeArea: pixelInsetsSchema,
  titleLevel: z.enum(["H0", "H1"]),
  modules: z.array(activityModuleSchema),
  backgroundMode: z.literal("full_bleed"),
  focalArea: normalizedRectSchema,
  textSafeArea: normalizedRectSchema,
  logoZones: z.object({
    company: pixelRectSchema,
    administration: pixelRectSchema
  }),
  qrZone: pixelRectSchema.nullable(),
  overflow: z.object({
    titleMaxLines: z.literal(3),
    titleStrategy: z.literal("block_export"),
    bodyStrategy: z.enum(["fit_declared_modules", "auto_height"])
  }),
  measurementSource: z.object({
    svg: z.string().min(1),
    note: z.string().min(1)
  })
});

export const activityTemplateFamilyManifestSchema = z.object({
  id: z.literal("employee-activity-template-family"),
  version: z.literal("1.0.0"),
  scene: z.literal("employee_activity"),
  brandSpecVersion: brandSpecVersionSchema,
  renderTargets: z.object({
    portrait_1080x1920: renderTargetManifestSchema,
    landscape_1920x1080: renderTargetManifestSchema,
    banner_2227x950: renderTargetManifestSchema,
    longform_1080xAuto: renderTargetManifestSchema
  })
});

export const activityTemplateFamilyManifest =
  activityTemplateFamilyManifestSchema.parse({
    id: "employee-activity-template-family",
    version: "1.0.0",
    scene: "employee_activity",
    brandSpecVersion: 1,
    renderTargets: {
      portrait_1080x1920: {
        id: "portrait_1080x1920",
        templateId: "employee-activity-portrait",
        templateVersion: "1.0.0-draft",
        dimensions: {
          width: 1080,
          heightMode: "fixed",
          height: 1920
        },
        safeArea: { top: 80, right: 72, bottom: 72, left: 72 },
        titleLevel: "H0",
        modules: [
          "brand_header",
          "title",
          "subtitle",
          "summary",
          "all_sessions",
          "highlights",
          "participation",
          "notice",
          "cta",
          "qr",
          "footer"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0.42, y: 0.18, width: 0.53, height: 0.55 },
        textSafeArea: { x: 0.067, y: 0.14, width: 0.52, height: 0.7 },
        logoZones: {
          company: { x: 72, y: 80, width: 280, height: 82.5179 },
          administration: {
            x: 931.5,
            y: 83.0089,
            width: 76.5001,
            height: 76.5001
          }
        },
        qrZone: { x: 864, y: 1588, width: 144, height: 144 },
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/poster/T01 体育赛事.svg",
          note:
            "Logo 与二维码区按 SVG 原始坐标测量；焦点区与文字区按全幅背景构图约束记录，B2 视觉评审前仍可调整。"
        }
      },
      landscape_1920x1080: {
        id: "landscape_1920x1080",
        templateId: "employee-activity-landscape",
        templateVersion: "1.0.0-draft",
        dimensions: {
          width: 1920,
          heightMode: "fixed",
          height: 1080
        },
        safeArea: { top: 80, right: 72, bottom: 72, left: 72 },
        titleLevel: "H0",
        modules: [
          "brand_header",
          "title",
          "subtitle",
          "summary",
          "primary_session",
          "highlights",
          "cta",
          "footer"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0.52, y: 0.18, width: 0.43, height: 0.65 },
        textSafeArea: { x: 0.038, y: 0.2, width: 0.47, height: 0.62 },
        logoZones: {
          company: { x: 72, y: 80, width: 280, height: 82.5179 },
          administration: {
            x: 1771.5,
            y: 83.0088,
            width: 76.5001,
            height: 76.5001
          }
        },
        qrZone: null,
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/Landscape/1920×1080.svg",
          note:
            "双标识按 SVG 原始坐标测量；横版只投影核心事实，不通过整体缩字承载完整规则。"
        }
      },
      banner_2227x950: {
        id: "banner_2227x950",
        templateId: "employee-activity-banner",
        templateVersion: "1.0.0-draft",
        dimensions: {
          width: 2227,
          heightMode: "fixed",
          height: 950
        },
        safeArea: { top: 80, right: 72, bottom: 72, left: 72 },
        titleLevel: "H0",
        modules: [
          "brand_header",
          "title",
          "primary_session",
          "footer"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0.58, y: 0.15, width: 0.37, height: 0.7 },
        textSafeArea: { x: 0.036, y: 0.22, width: 0.48, height: 0.58 },
        logoZones: {
          company: { x: 72, y: 80, width: 280, height: 82.5179 },
          administration: {
            x: 2078.5,
            y: 83.0088,
            width: 76.5001,
            height: 76.5001
          }
        },
        qrZone: null,
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/Banner/2227×950.svg",
          note:
            "双标识按 SVG 原始坐标测量；Banner 只保留主题与关键时间信息。"
        }
      },
      longform_1080xAuto: {
        id: "longform_1080xAuto",
        templateId: "employee-activity-longform",
        templateVersion: "1.0.0-draft",
        dimensions: {
          width: 1080,
          heightMode: "auto",
          minHeight: 1920,
          maxHeight: 12000
        },
        safeArea: { top: 82, right: 72, bottom: 72, left: 72 },
        titleLevel: "H1",
        modules: [
          "brand_header",
          "title",
          "subtitle",
          "summary",
          "all_sessions",
          "highlights",
          "participation",
          "notice",
          "cta",
          "qr",
          "footer"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0.42, y: 0.06, width: 0.52, height: 0.34 },
        textSafeArea: { x: 0.067, y: 0.08, width: 0.52, height: 0.34 },
        logoZones: {
          company: { x: 81, y: 82, width: 280, height: 82.5179 },
          administration: {
            x: 922.5,
            y: 85.0088,
            width: 76.5001,
            height: 76.5001
          }
        },
        qrZone: { x: 97, y: 2563, width: 238, height: 238 },
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "auto_height"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/Longform/1080×3000.svg",
          note:
            "双标识、内容卡和二维码区按 3000px 设计样例测量；运行时高度必须按内容自动计算，不能固定为 3000px。"
        }
      }
    }
  });

export type ActivityTemplateFamilyManifest = z.infer<
  typeof activityTemplateFamilyManifestSchema
>;
export type RenderTargetManifest = z.infer<
  typeof renderTargetManifestSchema
>;
