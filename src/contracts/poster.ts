import { z } from "zod";
import {
  brandSpecVersionSchema,
  defaultRenderTargetIds,
  renderTargetIdSchema
} from "./brand";

export const outputFormatSchema = z.literal("portrait_1080x1920");
export const activityCategorySchema = z.enum(["team", "festival", "competition"]);
export const finalistGroupLabels = ["男单", "女单", "混合双人", "男子双人", "女子双人"] as const;
export const sportTypeSchema = z.enum(["auto", "tennis", "badminton", "basketball", "football", "volleyball", "table_tennis", "tug_of_war", "running", "other"]);
export const sportsThemeColorSchema = z.enum(["auto", "blue", "green", "red", "yellow", "purple", "orange", "neutral"]);
export const peopleModeSchema = z.enum(["auto", "forbid", "allow"]);
export const sportsVisualTypeSchema = z.enum(["auto", "action", "equipment", "venue"]);
export const visualPreferenceSchema = z.object({
  themeColor: sportsThemeColorSchema.default("auto"),
  peopleMode: peopleModeSchema.default("auto"),
  visualType: sportsVisualTypeSchema.default("auto"),
  visualTreatment: z.string().trim().max(80).default("")
});

const sportKeywords = /网球|羽毛球|羽球|篮球|足球|排球|乒乓球|乒乓|拔河|跑步|马拉松|接力|田径/;
export function isRecognizedSportsActivity(value: string) {
  return sportKeywords.test(value);
}
// Figma V2 uses 952px-wide, auto-height title slots. Recommendations guide
// authors; rendered bounds remain the export gate.
export const t01PortraitTitleMaxCharacters = 40;
export const t01PortraitTitleMaxLines = 2;
export const t01PortraitSubtitleMaxCharacters = 40;
export const t01PortraitTitleRecommendedCharacters = 14;
export const t01PortraitSubtitleRecommendedCharacters = 25;

export function textCharacterCount(value: string) {
  return Array.from(value.trim()).length;
}

export function textLineCount(value: string) {
  return value.trim().replace(/\r\n?/g, "\n").split("\n").length;
}

function hasValidT01TitleLines(value: string) {
  return textLineCount(value) <= t01PortraitTitleMaxLines;
}

export const activitySessionSchema = z.object({
  label: z.string().trim().min(1, "请填写场次名称").max(24),
  // Banner can stand alone with only its title. The form applies the stricter
  // date/location requirement whenever a fact-bearing template is selected.
  date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请使用 YYYY-MM-DD 格式"), z.literal("")]),
  // T01 V3 only collects a date. Keep an optional legacy time for existing jobs.
  time: z.string().trim().max(40).default(""),
  location: z.string().trim().max(80),
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

const finalistEntrantSchema = z.object({
  name: z.string().trim().min(1, "请填写名单姓名").max(16, "姓名请控制在 16 字以内"),
  region: z.string().trim().min(1, "请填写所属赛区").max(24, "赛区请控制在 24 字以内")
});

export const finalistGroupSchema = z.object({
  label: z.enum(finalistGroupLabels),
  entrants: z.array(finalistEntrantSchema).max(6, "每个组别最多 6 人")
});

export const finalistGroupsSchema = z.array(finalistGroupSchema).max(5).optional();

function validateLongformRoster(
  finalistGroups: Array<z.infer<typeof finalistGroupSchema>> | undefined,
  renderTargets: readonly z.infer<typeof renderTargetIdSchema>[],
  context: z.RefinementCtx
) {
  if (!renderTargets.includes("longform_1080xAuto")) return;
  // Historical jobs predate the roster contract. New form submissions always
  // send this field; preserve renderability of immutable legacy versions.
  if (finalistGroups === undefined) return;
  if (finalistGroups.length !== finalistGroupLabels.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["input", "finalistGroups"], message: "长图需要填写全部 5 个固定组别的名单" });
    return;
  }
  finalistGroupLabels.forEach((label, index) => {
    const group = finalistGroups[index];
    if (!group || group.label !== label) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["input", "finalistGroups", index, "label"], message: "长图名单组别需按固定顺序填写" });
    } else if (group.entrants.length < 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["input", "finalistGroups", index, "entrants"], message: `${label}至少需要填写 1 人` });
    }
  });
}

function validateSportsScope(
  input: { activityName: string; description: string; rules: string; sportType: z.infer<typeof sportTypeSchema>; sportsConfirmed: boolean },
  context: z.RefinementCtx
) {
  const source = `${input.activityName} ${input.description} ${input.rules}`;
  if (input.sportType === "auto" && !isRecognizedSportsActivity(source)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["input", "sportType"], message: "未识别到体育项目。当前模板仅生成体育赛事主视觉，请明确选择体育项目；非体育活动请改用对应场景。" });
  }
  if (input.sportType === "other" && !input.sportsConfirmed) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["input", "sportsConfirmed"], message: "请选择“确认这是体育赛事”后继续生成。" });
  }
}

const employeeActivityFieldsSchema = z.object({
    activityName: z
      .string()
      .trim()
      .min(1, "请填写活动名称")
      .max(150, "活动名称请控制在 150 字以内")
      .refine(
        hasValidT01TitleLines,
        `一级大标题最多 ${t01PortraitTitleMaxLines} 行，请删除多余换行`
      ),
    category: activityCategorySchema.default("team"),
    themeKeywords: z.array(z.string().trim().min(1).max(24)).max(6).default([]),
    // The trial UI treats these as optional narrative fields. Keep the names
    // for legacy jobs and let the copy projection omit empty slots.
    description: z.string().trim().max(240).default(""),
    slogan: z.string().trim().max(40).default(""),
    subtitle: z.string().trim().max(t01PortraitSubtitleMaxCharacters).default(""),
    sessions: z.array(activitySessionSchema).min(1).max(2),
    audience: z
      .string()
      .trim()
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
    prize: z.string().trim().max(240).default(""),
    finalistGroups: finalistGroupsSchema,
    sportType: sportTypeSchema.default("auto"),
    themeColor: sportsThemeColorSchema.default("auto"),
    peopleMode: peopleModeSchema.default("auto"),
    visualType: sportsVisualTypeSchema.default("auto"),
    visualTreatment: z.string().trim().max(80).default(""),
    sportsConfirmed: z.boolean().default(false)
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
      .min(1)
      .max(4)
      .default([...defaultRenderTargetIds])
  })
  .superRefine(validateQrRequirement);

export const posterDocumentSchema = z.object({
  schemaVersion: z.literal("1.7"),
  scene: z.literal("employee_activity"),
  locale: z.literal("zh-CN"),
  outputFormat: outputFormatSchema,
  category: activityCategorySchema,
  // Text capacity is enforced against the rendered 952px slot, rather than
  // a character-count cutoff that can reject a perfectly valid short glyph run.
  title: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .refine(
      hasValidT01TitleLines,
      `一级大标题最多 ${t01PortraitTitleMaxLines} 行`
    ),
  slogan: z.string().max(40).default(""),
  subtitle: z.string().max(150),
  summary: z.string().max(150).default(""),
  sessions: z.array(activitySessionSchema).min(0).max(2),
  audience: z.string().max(40),
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
  finalistGroups: finalistGroupsSchema,
  immutableSource: z.object({
    outputFormat: z.literal(true),
    sessions: z.literal(true),
    audience: z.literal(true),
    contact: z.literal(true),
    includeQr: z.literal(true),
    ctaLabel: z.literal(true),
    qrPayload: z.literal(true),
    qrAssetId: z.literal(true),
    notice: z.literal(true),
    finalistGroups: z.literal(true).optional()
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
  title: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine(
      hasValidT01TitleLines,
      `一级大标题最多 ${t01PortraitTitleMaxLines} 行`
    ),
  slogan: z.string().trim().max(40).default(""),
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
  systemDirection: z.string().trim().max(1400).optional(),
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
  idempotencyKey: z.string().uuid(),
  // Manual confirmation deliberately bypasses copy generation. This is a
  // per-request choice, never a migration of historical tasks.
  skipCopy: z.boolean().default(false),
  renderTargets: z.array(renderTargetIdSchema).min(1).max(4).default([...defaultRenderTargetIds])
}).superRefine((value, context) => {
  validateLongformRoster(value.input.finalistGroups, value.renderTargets, context);
  validateSportsScope(value.input, context);
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
  preferences: visualPreferenceSchema,
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

export const selectVisualOptionSchema = z.object({
  optionId: z.string().uuid()
});

export const confirmVisualOptionSchema = z.object({
  optionId: z.string().uuid(),
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
export type VisualPreference = z.infer<typeof visualPreferenceSchema>;

export function campaignBriefFromLegacyInput(
  input: EmployeeActivityInput,
  renderTargets: readonly z.infer<typeof renderTargetIdSchema>[] = defaultRenderTargetIds
): CampaignBrief {
  const facts = employeeActivityFieldsSchema.parse(input);
  return campaignBriefSchema.parse({
    ...facts,
    schemaVersion: "1.1",
    scene: "employee_activity",
    locale: "zh-CN",
    brandSpecVersion: 1,
    renderTargets: [...renderTargets]
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
