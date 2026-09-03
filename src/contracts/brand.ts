import { z } from "zod";

export const brandSpecVersionSchema = z.literal(1);

export const renderTargetIdSchema = z.enum([
  "portrait_1080x1920",
  "landscape_1920x1080",
  "banner_2227x950",
  "longform_1080xAuto"
]);

export const defaultRenderTargetIds = [
  "portrait_1080x1920",
  "landscape_1920x1080",
  "banner_2227x950",
  "longform_1080xAuto"
] as const;

export const brandTokensSchema = z.object({
  colors: z.object({
    brandBlack: z.literal("#000000"),
    surface: z.literal("#F5F5F2"),
    adminYellow: z.literal("#FAE24C"),
    activityRed: z.literal("#DA291C")
  }),
  typography: z.object({
    family: z.literal("MiSans"),
    h0Px: z.literal(120),
    h1Px: z.literal(80),
    titleMaxLines: z.literal(3)
  }),
  brandHeader: z.object({
    companyLogoPosition: z.literal("left"),
    administrationMarkPosition: z.literal("right"),
    preserveAspectRatio: z.literal(true)
  })
});

export const brandSpecSchema = z.object({
  brandSpecVersion: brandSpecVersionSchema,
  id: z.literal("ninebot-admin-employee-activity"),
  scene: z.literal("employee_activity"),
  status: z.literal("locked"),
  tokens: brandTokensSchema,
  defaultRenderTargets: z.tuple([
    z.literal("portrait_1080x1920"),
    z.literal("landscape_1920x1080"),
    z.literal("banner_2227x950"),
    z.literal("longform_1080xAuto")
  ]),
  rules: z.object({
    titleOverflow: z.literal("block_export"),
    longformHeight: z.literal("auto"),
    importantTextCropping: z.literal("forbidden"),
    llmLayoutControl: z.literal("forbidden"),
    imageModelText: z.literal("forbidden")
  })
});

export type BrandSpecVersion = z.infer<typeof brandSpecVersionSchema>;
export type RenderTargetId = z.infer<typeof renderTargetIdSchema>;
export type BrandTokens = z.infer<typeof brandTokensSchema>;
export type BrandSpec = z.infer<typeof brandSpecSchema>;
