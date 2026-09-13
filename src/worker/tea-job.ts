import crypto from "node:crypto";
import sharp from "sharp";
import { findTeaJob, updateTeaJob } from "@/server/job-store";
import { generateControlledImage } from "@/providers/illustration-provider";
import { teaImagePrompt } from "@/providers/tea-provider";
import { renderTea } from "@/templates/tea-renderer";
import { serverEnv } from "@/lib/env";

export async function runTeaVisuals(id: string, optionIds: string[]) {
  const job = await findTeaJob(id);
  if (!job || job.status !== "GENERATING_ASSET") return;
  await Promise.allSettled(optionIds.map(async optionId => {
    const option = job.options.find(o => o.id === optionId);
    if (!option) return;
    try {
      await updateTeaJob(id, j => ({ ...j, options: j.options.map(o => o.id === optionId ? { ...o, status: "GENERATING", error: undefined } : o) }));
      const actualPrompt = teaImagePrompt(job.fields, option.description, option.direction);
      const image = await generateControlledImage({ prompt: actualPrompt, size: "1024x1536", failWithoutFallback: true }, `${id}-${crypto.randomUUID()}`);
      const previewPath = image.path.replace(/\.[^.]+$/, "-preview.jpg");
      await sharp(image.path).resize({ width: 432 }).jpeg({ quality: 82 }).toFile(previewPath);
      await updateTeaJob(id, j => ({ ...j, options: j.options.map(o => o.id === optionId ? { ...o, status: "READY", assetPath: image.path, previewPath, actualPrompt, provider: image.provider, model: image.model } : o) }));
    } catch {
      await updateTeaJob(id, j => ({ ...j, options: j.options.map(o => o.id === optionId ? { ...o, status: "FAILED", error: "图片生成失败或超时，请重试该方案" } : o) }));
    }
  }));
  await updateTeaJob(id, j => ({ ...j, status: "READY_FOR_VISUAL_REVIEW" }));
}

export async function runTeaRender(id: string, optionId: string) {
  const job = await findTeaJob(id);
  const option = job?.options.find(o => o.id === optionId && o.status === "READY");
  if (!job || !option?.assetPath || job.status !== "RENDERING") return;
  try {
    const outputId = `${id}-${crypto.randomUUID()}`;
    const output = await renderTea(job.fields, option.assetPath, outputId, serverEnv.READABILITY_MODE);
    await updateTeaJob(id, j => ({ ...j, status: "READY_FOR_REVIEW", outputs: [...j.outputs, { ...output, id: outputId, optionId, sourceVersionId: job.sourceVersionId }], error: undefined }));
  } catch {
    await updateTeaJob(id, j => ({ ...j, status: "READY_FOR_VISUAL_REVIEW", error: "排版未完成，请检查文字容量后重试；原图已保留，不会重新生图。" }));
  }
}
