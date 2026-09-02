import { z } from "zod";

export const activityCategorySchema = z.enum(["team", "festival", "competition"]);
export const activitySessionSchema = z.object({
  label: z.string().trim().min(1, "请填写场次名称").max(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请使用 YYYY-MM-DD 格式"),
  time: z.string().trim().min(1, "请填写活动时间").max(40),
  location: z.string().trim().min(1, "请填写活动地点").max(80),
  details: z.array(z.string().trim().min(1).max(42)).max(3).default([])
});

export const employeeActivityInputSchema = z.object({
  activityName: z.string().trim().min(1, "请填写活动名称").max(48, "活动名称请控制在 48 字以内"),
  category: activityCategorySchema.default("team"),
  themeKeywords: z.array(z.string().trim().min(1).max(24)).max(6).default([]),
  description: z.string().trim().min(8, "活动简介至少 8 个字").max(240),
  sessions: z.array(activitySessionSchema).min(1).max(2),
  highlights: z.array(z.string().trim().min(1).max(22)).min(2, "至少填写两项活动亮点").max(4),
  participationSteps: z.array(z.string().trim().min(1).max(52)).min(1, "请填写至少一条参与方式").max(4),
  notice: z.string().trim().min(1, "请填写注意事项").max(160),
  ctaLabel: z.string().trim().max(32).optional().default(""), qrPayload: z.string().trim().max(300).optional().default(""), contact: z.string().trim().max(80).optional().default(""),
  visualIntent: z.string().trim().min(10, "请用至少 10 个字描述主视觉").max(180)
});

export const posterDocumentSchema = z.object({
  schemaVersion: z.literal("1.5"), scene: z.literal("employee_activity"), locale: z.literal("zh-CN"), category: activityCategorySchema,
  title: z.string().min(1).max(40), subtitle: z.string().max(56), summary: z.string().min(1).max(150), sessions: z.array(activitySessionSchema).min(1).max(2), highlights: z.array(z.string().min(1).max(22)).min(2).max(4), participationSteps: z.array(z.string().min(1).max(52)).min(1).max(4), notice: z.string().min(1).max(160), ctaLabel: z.string().max(32), qrPayload: z.string().max(300), contact: z.string().max(80),
  immutableSource: z.object({ sessions: z.literal(true), contact: z.literal(true), ctaLabel: z.literal(true), qrPayload: z.literal(true), notice: z.literal(true) })
});
export const illustrationBriefSchema = z.object({ subject: z.string().min(2).max(80), action: z.string().min(2).max(80), setting: z.string().min(2).max(80), composition: z.string().min(2).max(80), palette: z.string().min(2).max(60), style: z.string().min(2).max(60), mood: z.string().min(2).max(60), negative: z.literal("不要文字、字母、数字、Logo、二维码、水印、签名") });
export const generationStatusSchema = z.enum(["QUEUED", "VALIDATING_INPUT", "GENERATING_COPY", "GENERATING_ASSET", "RENDERING", "VALIDATING_OUTPUT", "READY_FOR_REVIEW", "FAILED_FINAL"]);
export type EmployeeActivityInput = z.infer<typeof employeeActivityInputSchema>; export type PosterDocument = z.infer<typeof posterDocumentSchema>; export type IllustrationBrief = z.infer<typeof illustrationBriefSchema>; export type GenerationStatus = z.infer<typeof generationStatusSchema>;
export const createJobSchema = z.object({ input: employeeActivityInputSchema, idempotencyKey: z.string().uuid() });
export const posterDocumentJsonSchema = { $schema: "https://json-schema.org/draft/2020-12/schema", title: "PosterDocumentV1_5", type: "object", required: ["schemaVersion", "scene", "locale", "category", "title", "subtitle", "summary", "sessions", "highlights", "participationSteps", "notice", "immutableSource"], properties: { schemaVersion: { const: "1.5" }, scene: { const: "employee_activity" }, locale: { const: "zh-CN" }, title: { type: "string", maxLength: 40 }, sessions: { type: "array", minItems: 1, maxItems: 2 }, highlights: { type: "array", minItems: 2, maxItems: 4 } } } as const;
