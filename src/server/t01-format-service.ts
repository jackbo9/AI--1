import crypto from "node:crypto";
import path from "node:path";
import type { Artifact, CampaignGenerationJob } from "@/contracts/job";
import type { PosterDocument } from "@/contracts/poster";
import { findJob, updateJob } from "./job-store";
import { extraTemplateVersion, renderT01Extra, ExtraRenderError, type ExtraFormat } from "@/templates/t01-extra-renderer";
import { serverEnv } from "@/lib/env";

export function formatOutputs(job: CampaignGenerationJob) {
  return job.artifacts.map(artifact => ({
    id: artifact.id, format: artifact.renderTargetId, status: artifact.status,
    width: artifact.width, height: artifact.height, createdAt: artifact.createdAt,
    documentVersionId: artifact.documentVersionId, visualFamilyId: artifact.visualFamilyId,
    validation: artifact.validation, error: artifact.error,
    previewUrl: artifact.status === "READY" && (artifact.validation.exportAllowed ?? artifact.validation.passed) && artifact.outputPath
      ? `/api/files/${path.basename(artifact.outputPath)}` : undefined
  }));
}

export async function claimFormat(jobId: string, userId: string, format: ExtraFormat) {
  let claimed: Artifact | undefined;
  let reused: Artifact | undefined;
  let sourceDocument: PosterDocument | undefined;
  await updateJob(jobId, job => {
    if (job.userId !== userId) throw new ExtraRenderError("JOB_FORBIDDEN", "你无权访问该任务");
    const version = job.versions.at(-1);
    if (job.status !== "READY_FOR_REVIEW" || !version || !(version.validation.exportAllowed ?? version.validation.passed)) {
      throw new ExtraRenderError("SOURCE_NOT_READY", "请先完成主视觉与竖版生成，再生成其他尺寸");
    }
    const documentVersionId = job.confirmedDocument?.documentVersionId ?? version.id;
    sourceDocument = version.posterDocument;
    const visualFamilyId = job.visualMaster?.visualFamilyId ?? version.id;
    reused = [...job.artifacts].reverse().find(artifact => artifact.renderTargetId === format && artifact.documentVersionId === documentVersionId && artifact.visualFamilyId === visualFamilyId && artifact.templateVersion === extraTemplateVersion && artifact.status !== "FAILED");
    if (reused) return job;
    claimed = {
      id: crypto.randomUUID(), renderTargetId: format, status: "RENDERING", createdAt: new Date().toISOString(),
      brandSpecVersion: 1, documentVersionId, visualFamilyId,
      width: format === "landscape_1920x1080" ? 1920 : format === "banner_2227x950" ? 2227 : 1080,
      heightMode: format === "longform_1080xAuto" ? "auto" : "fixed",
      templateId: `employee-activity-${format.split("_")[0]}`, templateVersion: extraTemplateVersion,
      assetMode: version.assetMode === "fallback" ? "fallback" : "derived", assetPath: version.assetPath,
      assetDetail: "复用本次已生成的主视觉，按模板裁切；未再次调用图片模型。",
      validation: { passed: false, exportAllowed: false, messages: ["正在检查模板输出"] }
    };
    return { ...job, artifacts: [...job.artifacts, claimed] };
  });
  return { artifact: claimed ?? reused!, claimed: Boolean(claimed), sourceDocument: sourceDocument! };
}

export async function renderClaimedFormat(jobId: string, artifactId: string, format: ExtraFormat, document: PosterDocument) {
  const job = await findJob(jobId);
  const artifact = job?.artifacts.find(item => item.id === artifactId);
  if (!job || !artifact || artifact.status !== "RENDERING" || !artifact.assetPath) return;
  // The snapshot was frozen at atomic claim, before any subsequent regeneration.
  try {
    const rendered = await renderT01Extra(format, document, artifact.assetPath, `${jobId}-${artifact.id}`, { readabilityMode: serverEnv.READABILITY_MODE });
    const contrastPassed = rendered.contrast?.passed ?? true;
    await updateJob(jobId, current => ({ ...current, artifacts: current.artifacts.map(item => item.id !== artifactId ? item : {
      ...item, status: "READY", width: rendered.width, height: rendered.height, outputPath: rendered.outputPath,
      validation: {
        passed: contrastPassed, exportAllowed: true, strategy: serverEnv.READABILITY_MODE,
        checks: rendered.checks,
        messages: [
          "已检查字体与图片加载、内容容量、画布尺寸。",
          ...(rendered.contrast ? [contrastPassed ? "实际文字区背景采样对比度通过。" : "文字与背景对比度待优化，可下载试用稿。"] : ["长图正文使用模板固定纯色内容区；未执行背景像素对比度检测。"])
        ]
      }
    }) }));
  } catch (error) {
    await updateJob(jobId, current => ({ ...current, artifacts: current.artifacts.map(item => item.id !== artifactId ? item : {
      ...item, status: "FAILED",
      error: { code: error instanceof ExtraRenderError ? error.code : "FORMAT_RENDER_FAILED", message: error instanceof ExtraRenderError ? error.message : "该尺寸暂未生成成功，请重试" },
      validation: { passed: false, exportAllowed: false, messages: ["该尺寸未通过输出检查，其他已完成尺寸仍可使用。"] }
    }) }));
  }
}
