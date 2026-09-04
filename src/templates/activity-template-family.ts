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
  "audience",
  "deadline",
  "contact",
  "rules",
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
  backgroundMode: z.enum(["full_bleed", "image_slot"]),
  focalArea: normalizedRectSchema,
  textSafeArea: normalizedRectSchema,
  logoZones: z.object({
    company: pixelRectSchema,
    administration: pixelRectSchema
  }),
  qrZone: pixelRectSchema.nullable(),
  qrPlacement: z.enum(["fixed", "content_flow"]).optional(),
  overflow: z.object({
    titleMaxLines: z.number().int().min(1).max(3),
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
        templateVersion: "1.2.0-t01-readability",
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
          "all_sessions",
          "audience",
          "participation",
          "qr",
          "footer"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0.42, y: 0.34, width: 0.53, height: 0.45 },
        textSafeArea: { x: 0.067, y: 0.16, width: 0.866, height: 0.36 },
        logoZones: {
          company: { x: 72, y: 80, width: 280, height: 82.5179 },
          administration: {
            x: 931.5,
            y: 83.0089,
            width: 76.5001,
            height: 76.5001
          }
        },
        qrZone: { x: 864, y: 1574, width: 144, height: 144 },
        overflow: {
          titleMaxLines: 1,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/poster/T01 体育赛事.svg",
          note:
            "Figma 191:2777 浅色 T01 母版：全幅背景、单行 H0 标题、三组底部信息及条件二维码；案例 191:3642 的反白色值不构成第二主题。"
        }
      },
      landscape_1920x1080: {
        id: "landscape_1920x1080",
        templateId: "employee-activity-landscape",
        templateVersion: "t01-figma-2026-09-04-v1",
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
          "all_sessions",
          "audience",
          "rules",
          "footer"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0.52, y: 0.18, width: 0.43, height: 0.65 },
        textSafeArea: { x: 0.038, y: 0.2, width: 0.47, height: 0.62 },
        logoZones: {
          company: { x: 81, y: 82, width: 280, height: 82.5179 },
          administration: {
            x: 1771.5,
            y: 83.0088,
            width: 76.5001,
            height: 76.5001
          }
        },
        qrZone: null,
        overflow: {
          titleMaxLines: 1,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/Landscape/1920×1080.svg",
          note:
            "Figma 191:3112 / 案例 191:3677：单行120px标题，描述、全部场次、参与对象与规则；超出固定容量阻止导出。"
        }
      },
      banner_2227x950: {
        id: "banner_2227x950",
        templateId: "employee-activity-banner",
        templateVersion: "t01-figma-2026-09-04-v1",
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
          "all_sessions",
          "audience",
          "subtitle",
          "footer"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0.58, y: 0.15, width: 0.37, height: 0.7 },
        textSafeArea: { x: 0.036, y: 0.22, width: 0.48, height: 0.58 },
        logoZones: {
          company: { x: 81, y: 82, width: 280, height: 82.5179 },
          administration: {
            x: 2078.5,
            y: 83.0088,
            width: 76.5001,
            height: 76.5001
          }
        },
        qrZone: null,
        overflow: {
          titleMaxLines: 1,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/Banner/2227×950.svg",
          note:
            "Figma 191:3138 / 案例 191:3708：单行120px标题、两行核心事实及四行描述；无二维码和详细规则槽位。"
        }
      },
      longform_1080xAuto: {
        id: "longform_1080xAuto",
        templateId: "employee-activity-longform",
        templateVersion: "t01-figma-2026-09-04-v1",
        dimensions: {
          width: 1080,
          heightMode: "auto",
          minHeight: 1920,
          maxHeight: 12000
        },
        safeArea: { top: 82, right: 72, bottom: 72, left: 72 },
        titleLevel: "H0",
        modules: [
          "brand_header",
          "title",
          "subtitle",
          "summary",
          "all_sessions",
          "audience",
          "deadline",
          "contact",
          "rules",
          "highlights",
          "participation",
          "notice",
          "cta",
          "qr",
          "footer"
        ],
        backgroundMode: "image_slot",
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
        qrZone: { x: 96, y: 2562, width: 240, height: 240 },
        qrPlacement: "content_flow",
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "auto_height"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/Longform/1080×3000.svg",
          note:
            "Figma 191:3158：独立936×780图片槽、120px标题、信息卡及规则卡；二维码坐标仅为3000px样例参考，运行时随内容流布局，缺失组隐藏。"
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
