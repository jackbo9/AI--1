import crypto from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { teaCreateSchema, teaScene, type TeaJob, type TeaOption } from "@/contracts/tea";
import { createTeaJob, findTeaJob, updateTeaJob } from "./job-store";
import { runTeaRender, runTeaVisuals } from "@/worker/tea-job";
import { readJsonRequest } from "./request-json";

const error = (message: string, status = 400) => NextResponse.json({ error: { code: "TEA_ACTION_FAILED", message } }, { status });
export function publicTeaJob(job: TeaJob) {
  return { ...job, userId: undefined, idempotencyKey: undefined, actionIdempotencyKeys: undefined,
    options: job.options.map(o => ({ ...o, assetPath: undefined, previewPath: undefined, previewUrl: o.previewPath ? `/api/files/${path.basename(o.previewPath)}` : undefined })),
    outputs: job.outputs.map(o => ({ ...o, outputPath: undefined, previewUrl: o.outputPath && o.exportAllowed ? `/api/files/${path.basename(o.outputPath)}` : undefined }))
  };
}
export async function createTeaResponse(body: unknown, userId: string) {
  const parsed = teaCreateSchema.safeParse(body);
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "下午茶内容有误");
  if (parsed.data.previousJobId) {
    const previous = await findTeaJob(parsed.data.previousJobId);
    if (!previous || previous.userId !== userId) return error("历史任务不可访问", 403);
  }
  const now = new Date().toISOString();
  try {
    const job = await createTeaJob({ scene: teaScene, id: crypto.randomUUID(), userId, idempotencyKey: parsed.data.idempotencyKey, actionIdempotencyKeys: [], previousJobId: parsed.data.previousJobId, sourceVersionId: crypto.randomUUID(), fields: parsed.data.fields, status: "READY_FOR_VISUAL_REVIEW", options: [], outputs: [], createdAt: now, updatedAt: now });
    return NextResponse.json(publicTeaJob(job), { status: 202 });
  } catch { return error("创建任务失败或幂等键已被占用，请重试", 409); }
}

const actionSchema = z.object({ idempotencyKey: z.string().uuid(), optionId: z.string().uuid().optional(), directionId: z.string().uuid().optional(), description: z.string().trim().min(1).max(1200).optional(), sourceVersionId: z.string().uuid() });
export async function dispatchTeaAction(request: Request, id: string, userId: string, action: "generate" | "select" | "confirm" | "retry") {
  const job = await findTeaJob(id);
  if (!job) return null;
  if (job.userId !== userId) return error("你无权访问该任务", 403);
  const body = await readJsonRequest(request);
  const parsed = actionSchema.safeParse(body.ok ? body.value : undefined);
  if (!parsed.success) return error("请求内容无效，请刷新后重试");
  const input = parsed.data;
  let launch: string[] = [], renderId: string | undefined;
  try {
    const updated = await updateTeaJob(id, current => {
      if (current.actionIdempotencyKeys.includes(input.idempotencyKey)) return current;
      if (current.sourceVersionId !== input.sourceVersionId) throw new Error("内容版本已变化，请刷新");
      if (current.status === "GENERATING_ASSET" || current.status === "RENDERING") throw new Error("任务正在处理，请稍候");
      let next = { ...current, error: undefined, actionIdempotencyKeys: [...current.actionIdempotencyKeys, input.idempotencyKey] };
      if (action === "generate") {
        if (!input.description) throw new Error("请填写画面描述");
        const batchId = crypto.randomUUID();
        const options: TeaOption[] = ["近距离斜向视角，强调食品切面与细腻纹理。", "稍远的正面近景，强调食品自然层次；仍保持大主体、底部锚定和浅色留白。"].map(direction => ({ id: crypto.randomUUID(), batchId, direction, description: input.description!, sourceVersionId: current.sourceVersionId, status: "PENDING" }));
        launch = options.map(o => o.id);
        next = { ...next, status: "GENERATING_ASSET", selectedVisualOptionId: undefined, options: [...next.options, ...options] };
      } else {
        const option = current.options.find(o => o.id === (input.optionId ?? input.directionId) && o.sourceVersionId === current.sourceVersionId);
        if (!option) throw new Error("图片方案已失效");
        if (action === "retry") {
          if (option.status !== "FAILED") throw new Error("仅失败方案可以重试");
          launch = [option.id];
          next = { ...next, status: "GENERATING_ASSET", options: next.options.map(o => o.id === option.id ? { ...o, status: "PENDING", error: undefined } : o) };
        } else {
          if (option.status !== "READY") throw new Error("请先选择已生成的图片");
          next = { ...next, selectedVisualOptionId: option.id };
          if (action === "confirm") {
            const existing = current.outputs.find(o => o.optionId === option.id && o.sourceVersionId === current.sourceVersionId);
            if (existing) next = { ...next, status: "READY_FOR_REVIEW", outputs: [...next.outputs.filter(o => o.id !== existing.id), existing] };
            else { renderId = option.id; next = { ...next, status: "RENDERING" }; }
          }
        }
      }
      return next;
    });
    if (launch.length) void runTeaVisuals(id, launch);
    if (renderId) void runTeaRender(id, renderId);
    return NextResponse.json(publicTeaJob(updated), { status: 202 });
  } catch (cause) { return error(cause instanceof Error ? cause.message : "操作失败，请重试", 409); }
}
