import { z } from "zod";
import {
  brandSpecVersionSchema,
  defaultRenderTargetIds,
  renderTargetIdSchema
} from "./brand";

export const outputFormatSchema = z.literal("portrait_1080x1920");
export const activityCategorySchema = z.enum(["team", "festival", "competition"]);
// The portrait T01 title is a 120px, single-line slot. Keep this separate
// from the broader stored-document schema so legacy jobs remain readable.
export const t01PortraitTitleMaxCharacters = 5;
export const t01PortraitSubtitleMaxCharacters = 40;

export function textCharacterCount(value: string) {
  return Array.from(value.trim()).length;
}

export const activitySessionSchema = z.object({
  label: z.string().trim().min(1, "请填写场次名称").max(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请使用 YYYY-MM-DD 格式"),
  time: z.string().trim().min(1, "请填写活动时间").max(40),
  location: z.string().trim().min(1, "请填写活动地点").max(80),
  details: z.array(z.string().trim().min(1).max(42)).max(3).default([])
});

const optionalQrPayloadSchema = z
  .string()
  .trim()
  .max(300)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "二维码链接必须是有效的 HTTP 或 HTTPS 地址");

const optionalQrAssetIdSchema = z
  .string()
  .uuid()
  .or(z.literal(""))
  .optional()
  .default("");

const employeeActivityFieldsSchema = z.object({
    activityName: z
      .string()
      .trim()
      .min(1, "请填写活动名称")
      .max(48, "活动名称请控制在 48 字以内"),
    category: activityCategorySchema.default("team"),
    themeKeywords: z.array(z.string().trim().min(1).max(24)).max(6).default([]),
    // The trial UI treats these as optional narrative fields. Keep the names
    // for legacy jobs and let the copy projection omit empty slots.
    description: z.string().trim().max(240).default(""),
    sessions: z.array(activitySessionSchema).min(1).max(2),
    audience: z
      .string()
      .trim()
      .min(1, "请填写参与对象")
      .max(40, "参与对象请控制在 40 字以内"),
    highlights: z.array(z.string().trim().min(1).max(22)).max(4).default([]),
    participationSteps: z.array(z.string().trim().min(1).max(52)).max(4).default([]),
    notice: z.string().trim().max(160).default(""),
    includeQr: z.boolean().default(false),
    ctaLabel: z.string().trim().max(32).optional().default(""),
    qrPayload: optionalQrPayloadSchema.optional().default(""),
    qrAssetId: optionalQrAssetIdSchema,
    contact: z.string().trim().max(80).optional().default(""),
    visualIntent: z.string().trim().max(180).default(""),
    deadline: z.string().trim().max(80).default(""),
    rules: z.string().trim().max(240).default(""),
    prize: z.string().trim().max(240).default("")
  });

function validateQrRequirement(
  input: { includeQr: boolean; qrPayload: string; qrAssetId: string },
  context: z.RefinementCtx
) {
  const sourceCount = Number(Boolean(input.qrPayload)) + Number(Boolean(input.qrAssetId));
  if (input.includeQr && sourceCount === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["includeQr"],
      message: "启用二维码后请填写二维码链接或上传二维码图片"
    });
  }
  if (input.includeQr && sourceCount > 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["qrAssetId"],
      message: "二维码链接与上传图片只能选择一种"
    });
  }
  if (!input.includeQr && sourceCount > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["includeQr"],
      message: "未启用二维码时不能保留二维码链接或图片"
    });
  }
}

export const employeeActivityInputSchema = employeeActivityFieldsSchema
  .extend({
    outputFormat: outputFormatSchema.default("portrait_1080x1920")
  })
  .superRefine(validateQrRequirement);

export const campaignBriefSchema = employeeActivityFieldsSchema
  .extend({
    schemaVersion: z.literal("1.1"),
    scene: z.literal("employee_activity"),
    locale: z.literal("zh-CN"),
    brandSpecVersion: brandSpecVersionSchema,
    renderTargets: z
      .array(renderTargetIdSchema)
      .length(4)
      .default([...defaultRenderTargetIds])
  })
  .superRefine(validateQrRequirement);

export const posterDocumentSchema = z.object({
  schemaVersion: z.literal("1.7"),
  scene: z.literal("employee_activity"),
  locale: z.literal("zh-CN"),
  outputFormat: outputFormatSchema,
  category: activityCategorySchema,
  title: z.string().min(1).max(40),
  subtitle: z.string().max(150),
  summary: z.string().max(150).default(""),
  sessions: z.array(activitySessionSchema).min(1).max(2),
  audience: z.string().min(1).max(40),
  highlights: z.array(z.string().min(1).max(22)).max(4).default([]),
  participationSteps: z.array(z.string().min(1).max(52)).max(4).default([]),
  notice: z.string().max(160).default(""),
  includeQr: z.boolean(),
  ctaLabel: z.string().max(32),
  qrPayload: z.string().max(300),
  qrAssetId: z.string().uuid().or(z.literal("")).default(""),
  contact: z.string().max(80),
  deadline: z.string().max(80).optional(),
  rules: z.string().max(240).optional(),
  prize: z.string().max(240).optional(),
  immutableSource: z.object({
    outputFormat: z.literal(true),
    sessions: z.literal(true),
    audience: z.literal(true),
    contact: z.literal(true),
    includeQr: z.literal(true),
    ctaLabel: z.literal(true),
    qrPayload: z.literal(true),
    qrAssetId: z.literal(true),
    notice: z.literal(true)
  })
});

export const confirmedCampaignDocumentSchema = posterDocumentSchema
  .omit({
    schemaVersion: true,
    outputFormat: true,
    immutableSource: true
  })
  .extend({
    schemaVersion: z.literal("1.1"),
    brandSpecVersion: brandSpecVersionSchema,
    documentVersionId: z.string().uuid(),
    sourceCopySchemaVersion: z.literal("1.7")
  });

export const editablePosterContentSchema = z.object({
  title: z.string().trim().min(1).max(40),
  subtitle: z
    .string()
    .trim()
    .max(
      t01PortraitSubtitleMaxCharacters,
      `副标题最多 ${t01PortraitSubtitleMaxCharacters} 个字，请精简后重试`
    )
    .refine((value) => !/[\r\n]/.test(value), "副标题不能换行"),
  summary: z.string().trim().max(150).default(""),
  highlights: z.array(z.string().trim().min(1).max(22)).max(4).default([]),
  participationSteps: z.array(z.string().trim().min(1).max(52)).max(4).default([]),
  deadline: z.string().trim().max(80).default(""),
  rules: z.string().trim().max(240).default(""),
  prize: z.string().trim().max(240).default("")
});

export const illustrationBriefSchema = z.object({
  confirmedDescription: z.string().trim().min(2).max(420).optional(),
  visualStyleMode: z.enum(["editorial", "legacy"]).optional(),
  subject: z.string().min(2).max(80),
  action: z.string().min(2).max(80),
  setting: z.string().min(2).max(80),
  composition: z.string().min(2).max(420),
  palette: z.string().min(2).max(60),
  style: z.string().min(2).max(120),
  mood: z.string().min(2).max(60),
  negative: z.literal("不要文字、字母、数字、Logo、二维码、水印、签名")
});

export const visualMasterAssetSchema = z.object({
  renderTargetId: renderTargetIdSchema,
  path: z.string().min(1),
  mode: z.enum(["generated", "derived", "fallback"])
});

export const visualMasterSchema = z.object({
  id: z.string().uuid(),
  visualFamilyId: z.string().uuid(),
  sourceDocumentVersionId: z.string().uuid(),
  promptVersion: z.string().min(1),
  brief: illustrationBriefSchema,
  assets: z.array(visualMasterAssetSchema).default([])
});

export const generationStatusSchema = z.enum([
  "QUEUED",
  "VALIDATING_INPUT",
  "GENERATING_COPY",
  "READY_FOR_COPY_REVIEW",
  "READY_FOR_VISUAL_INPUT",
  "REFINING_VISUAL",
  "READY_FOR_VISUAL_REVIEW",
  "GENERATING_ASSET",
  "RENDERING",
  "VALIDATING_OUTPUT",
  "READY_FOR_REVIEW",
  "FAILED_FINAL"
]);

export const createJobSchema = z.object({
  input: employeeActivityInputSchema,
  idempotencyKey: z.string().uuid()
});

export const confirmCopySchema = z.object({
  content: editablePosterContentSchema,
  idempotencyKey: z.string().uuid()
});

export const refineVisualSchema = z.object({
  visualIntent: z
    .string()
    .trim()
    .min(10, "请至少描述 10 个字的画面想法")
    .max(420, "画面想法最多 420 字，请保留创意并精简后重试"),
  idempotencyKey: z.string().uuid()
});

export const confirmVisualSchema = z.object({
  sourceDraftCreatedAt: z.string().datetime(),
  description: z
    .string()
    .trim()
    .min(10, "请至少保留 10 个字的画面描述")
    .max(420, "画面描述最多 420 字，请保留创意并精简后重试"),
  idempotencyKey: z.string().uuid()
});

export const regenerateAssetSchema = z.object({
  idempotencyKey: z.string().uuid()
});

export type OutputFormat = z.infer<typeof outputFormatSchema>;
export type EmployeeActivityInput = z.infer<typeof employeeActivityInputSchema>;
export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
export type PosterDocument = z.infer<typeof posterDocumentSchema>;
export type ConfirmedCampaignDocument = z.infer<
  typeof confirmedCampaignDocumentSchema
>;
export type EditablePosterContent = z.infer<typeof editablePosterContentSchema>;
export type IllustrationBrief = z.infer<typeof illustrationBriefSchema>;
export type VisualMaster = z.infer<typeof visualMasterSchema>;
export type GenerationStatus = z.infer<typeof generationStatusSchema>;
export type VisualPromptInput = Pick<
  EmployeeActivityInput,
  "category" | "themeKeywords" | "visualIntent"
> &
  Partial<Omit<EmployeeActivityInput, "outputFormat" | "category" | "themeKeywords" | "visualIntent">>;

export function campaignBriefFromLegacyInput(
  input: EmployeeActivityInput
): CampaignBrief {
  const facts = employeeActivityFieldsSchema.parse(input);
  return campaignBriefSchema.parse({
    ...facts,
    schemaVersion: "1.1",
    scene: "employee_activity",
    locale: "zh-CN",
    brandSpecVersion: 1,
    renderTargets: [...defaultRenderTargetIds]
  });
}

export function legacyPortraitInputFromCampaignBrief(
  brief: CampaignBrief
): EmployeeActivityInput {
  const facts = employeeActivityFieldsSchema.parse(brief);
  return employeeActivityInputSchema.parse({
    ...facts,
    outputFormat: "portrait_1080x1920"
  });
}

export function confirmedCampaignDocumentFromPoster(
  document: PosterDocument,
  documentVersionId: string
): ConfirmedCampaignDocument {
  return confirmedCampaignDocumentSchema.parse({
    ...document,
    schemaVersion: "1.1",
    brandSpecVersion: 1,
    documentVersionId,
    sourceCopySchemaVersion: "1.7"
  });
}

export const posterDocumentJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "PosterDocumentV1_7",
  type: "object",
  required: [
    "schemaVersion",
    "scene",
    "locale",
    "outputFormat",
    "category",
    "title",
    "subtitle",
    "summary",
    "sessions",
    "audience",
    "highlights",
    "participationSteps",
    "notice",
    "includeQr",
    "ctaLabel",
    "qrPayload",
    "qrAssetId",
    "contact",
    "immutableSource"
  ],
  properties: {
    schemaVersion: { const: "1.7" },
    scene: { const: "employee_activity" },
    locale: { const: "zh-CN" },
    outputFormat: { const: "portrait_1080x1920" },
    title: { type: "string", maxLength: 40 },
    sessions: { type: "array", minItems: 1, maxItems: 2 },
    audience: { type: "string", minLength: 1, maxLength: 40 },
    highlights: { type: "array", minItems: 2, maxItems: 4 }
  }
} as const;
