import { z } from "zod";
import {
  brandSpecVersionSchema,
  renderTargetIdSchema
} from "@/contracts/brand";
import { t01PortraitLayout } from "./t01-portrait-layout";

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
    titleMaxLines: z.number().int().min(1).max(6),
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
        templateVersion: "2.0.0-figma-426-4",
        dimensions: {
          width: 1080,
          heightMode: "fixed",
          height: 1920
        },
        safeArea: { top: 64, right: 64, bottom: 102, left: 64 },
        titleLevel: "H0",
        modules: [
          "brand_header",
          "title",
          "subtitle",
          "all_sessions",
          "audience",
          "rules",
          "qr"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0, y: 0, width: 1, height: 0.65625 },
        textSafeArea: { x: 0.059, y: 0.1156, width: 0.882, height: 0.5073 },
        logoZones: {
          company: { x: 64, y: 64, width: 224, height: 66.014 },
          administration: {
            x: 954.8,
            y: 66.41,
            width: 61.2,
            height: 61.2
          }
        },
        qrZone: { x: 850, y: 1496, width: 134, height: 134 },
        overflow: {
          titleMaxLines: t01PortraitLayout.titleMaxLines,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "会议输入/03 Template Overview/Template/poster/T01 体育赛事.svg",
          note:
            "Figma 426:4：64px 水平边距，952px 宽的标题及副标题均自适应高度，二者间距 22px；标题组必须止于 y=1196。"
        }
      },
      landscape_1920x1080: {
        id: "landscape_1920x1080",
        templateId: "employee-activity-landscape",
        templateVersion: "t01-figma-2026-09-09-v3",
        dimensions: {
          width: 1920,
          heightMode: "fixed",
          height: 1080
        },
        safeArea: { top: 64, right: 64, bottom: 48, left: 64 },
        titleLevel: "H0",
        modules: [
          "brand_header",
          "title",
          "subtitle",
          "all_sessions",
          "audience",
          "rules",
          "qr"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0, y: 0, width: 1, height: 0.7222 },
        textSafeArea: { x: 0.0333, y: 0.213, width: 0.6188, height: 0.5 },
        logoZones: {
          company: { x: 64, y: 64, width: 224, height: 66.014 },
          administration: {
            x: 1794.8,
            y: 66.41,
            width: 61.2,
            height: 61.2
          }
        },
        qrZone: { x: 1704, y: 829, width: 134, height: 134 },
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "Figma node 426:74",
          note:
            "Figma 426:74：标题宽 1188px、高度自适应，建议不超过 14 字；副标题宽 1188px，建议不超过 25 字。"
        }
      },
      banner_2227x950: {
        id: "banner_2227x950",
        templateId: "employee-activity-banner",
        templateVersion: "t01-figma-2026-09-09-v3",
        dimensions: {
          width: 2227,
          heightMode: "fixed",
          height: 950
        },
        safeArea: { top: 64, right: 64, bottom: 64, left: 64 },
        titleLevel: "H0",
        modules: [
          "brand_header",
          "title",
          "subtitle"
        ],
        backgroundMode: "full_bleed",
        focalArea: { x: 0, y: 0, width: 1, height: 1 },
        textSafeArea: { x: 0.0287, y: 0.2316, width: 0.6255, height: 0.55 },
        logoZones: {
          company: { x: 64, y: 64, width: 224, height: 66.014 },
          administration: {
            x: 2101.8,
            y: 66.41,
            width: 61.2,
            height: 61.2
          }
        },
        qrZone: null,
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "Figma node 426:140",
          note:
            "Figma 426:140：标题宽 1393px、高度自适应，建议不超过 14 字；副标题宽 1393px，建议不超过 25 字。"
        }
      },
      longform_1080xAuto: {
        id: "longform_1080xAuto",
        templateId: "employee-activity-longform",
        templateVersion: "t01-figma-2026-09-09-v3",
        dimensions: {
          width: 1080,
          heightMode: "fixed",
          height: 3000
        },
        safeArea: { top: 64, right: 64, bottom: 63, left: 64 },
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
        backgroundMode: "full_bleed",
        focalArea: { x: 0, y: 0, width: 1, height: 0.4033 },
        textSafeArea: { x: 0.0593, y: 0.074, width: 0.8815, height: 0.3 },
        logoZones: {
          company: { x: 64, y: 64, width: 224, height: 66.014 },
          administration: {
            x: 954.8,
            y: 66.41,
            width: 61.2,
            height: 61.2
          }
        },
        qrZone: null,
        overflow: {
          titleMaxLines: 3,
          titleStrategy: "block_export",
          bodyStrategy: "fit_declared_modules"
        },
        measurementSource: {
          svg: "Figma node 426:156",
          note:
            "Figma 426:156：固定 1080×3000；标题宽 952px、高度自适应，建议不超过 14 字；副标题宽 952px，建议不超过 25 字。"
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
