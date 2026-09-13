import { z } from "zod";

export const teaScene = "employee-afternoon-tea" as const;
const line = (max: number, label: string) => z.string().trim().min(1, `请填写${label}`).regex(/^[^\r\n]+$/, `${label}请保持一行`).refine(s => Array.from(s).length <= max, `${label}最多 ${max} 字`);
export const teaFieldsSchema = z.object({
  brief: z.string().trim().min(1, "请填写下午茶想法").max(2000),
  food: line(100, "食品"), title: line(7, "主标题"), subtitle: line(24, "副标题"),
  visualPrompt: z.string().trim().min(1, "请填写画面描述").max(1200),
  time: z.string().max(200).default(""), place: z.string().max(200).default("")
});
export type TeaFields = z.infer<typeof teaFieldsSchema>;
export const emptyTeaFields: TeaFields = { brief: "", food: "", title: "", subtitle: "", visualPrompt: "", time: "", place: "" };
export function sameTeaFields(a: TeaFields, b: TeaFields) {
  return (Object.keys(emptyTeaFields) as Array<keyof TeaFields>).every(key => a[key].trim() === b[key].trim());
}
export const teaCreateSchema = z.object({ scene: z.literal(teaScene), fields: teaFieldsSchema, idempotencyKey: z.string().uuid(), previousJobId: z.string().uuid().optional() });
export type TeaOption = {
  id: string; batchId: string; status: "PENDING" | "GENERATING" | "READY" | "FAILED";
  direction: string; description: string; sourceVersionId: string;
  assetPath?: string; previewPath?: string; previewUrl?: string; error?: string;
  actualPrompt?: string; provider?: string; model?: string;
};
export type TeaOutput = {
  id: string; optionId: string; sourceVersionId: string; outputPath?: string; previewUrl?: string;
  templateVersion: string; passed: boolean; exportAllowed: boolean; messages: string[];
  contrast: number[]; width: number; height: number;
};
export type TeaJob = {
  scene: typeof teaScene; id: string; userId: string; idempotencyKey: string; actionIdempotencyKeys: string[];
  previousJobId?: string; sourceVersionId: string; fields: TeaFields;
  status: "READY_FOR_VISUAL_REVIEW" | "GENERATING_ASSET" | "RENDERING" | "READY_FOR_REVIEW";
  options: TeaOption[]; selectedVisualOptionId?: string; outputs: TeaOutput[];
  createdAt: string; updatedAt: string; error?: string;
};
export function isTeaJob(value: unknown): value is TeaJob {
  return Boolean(value && typeof value === "object" && "scene" in value && value.scene === teaScene);
}
export function recoverTeaJob(job: TeaJob): TeaJob {
  if (job.status !== "GENERATING_ASSET" && job.status !== "RENDERING") return job;
  return { ...job, status: "READY_FOR_VISUAL_REVIEW", updatedAt: new Date().toISOString(), error: "服务重启中断了操作，请重试；已有图片已保留。", options: job.options.map(o => o.status === "PENDING" || o.status === "GENERATING" ? { ...o, status: "FAILED", error: "服务重启中断，请重试该方案" } : o) };
}
