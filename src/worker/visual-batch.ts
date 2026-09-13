import crypto from "node:crypto";
import { findJob, updateJob } from "@/server/job-store";
import { legacyPortraitInputFromCampaignBrief } from "@/contracts/poster";
import { briefFromConfirmedDescription } from "@/providers/prompt-compiler";
import { generateIllustration, seedreamPrompt, imageRequestPrompt } from "@/providers/illustration-provider";
import type { VisualBatch } from "@/contracts/job";

export async function runVisualBatch(jobId: string, retry?: { batchId: string; directionId: string }) {
  const job = await findJob(jobId);
  if (!job || job.status !== "GENERATING_ASSET" || !job.copyDraft || !job.confirmedVisual) return;
  const batch: VisualBatch | undefined = retry
    ? job.visualBatches?.find(b => b.id === retry.batchId)
    : {
      id: job.confirmedVisual.batchId!,
      description: job.confirmedVisual.description,
      sourceCopyCreatedAt: job.copyDraft.createdAt,
      sourceDraftCreatedAt: job.confirmedVisual.sourceDraftCreatedAt,
      preferences: job.confirmedVisual.preferences,
      directions: [
        { id: crypto.randomUUID(), composition: "方向 A：较近距离、斜向视角，强调主体局部与材质层次。", status: "PENDING" },
        { id: crypto.randomUUID(), composition: "方向 B：较远距离、低机位，强调环境纵深与主体空间关系。", status: "PENDING" }
      ]
    };
  if (!batch) return;
  if (!retry) await updateJob(jobId, item => ({ ...item, visualBatches: [...(item.visualBatches ?? []), batch] }));
  await Promise.allSettled(batch.directions.filter(d => !retry || d.id === retry.directionId).map(async direction => {
    try {
      await updateJob(jobId, item => ({ ...item, visualBatches: item.visualBatches?.map(b => b.id === batch.id ? { ...b, directions: b.directions.map(d => d.id === direction.id ? { ...d, status: "GENERATING", error: undefined } : d) } : b) }));
      const input = { ...legacyPortraitInputFromCampaignBrief(job.campaignBrief), sportType: job.input.sportType };
      const brief = briefFromConfirmedDescription(batch.description, { ...input, ...batch.preferences });
      brief.systemDirection = (brief.systemDirection ?? "") + " " + direction.composition + "只改变观察角度与景别，核心区域和底部背景硬约束优先；保持主体、颜色、人物规则，不因低机位将主体上移。";
      seedreamPrompt(brief);
      const illustration = await generateIllustration(brief, jobId + "-" + crypto.randomUUID());
      if (illustration.mode !== "generated") throw new Error("图片模型未生成成功，请重试该方案");
      const optionId = crypto.randomUUID();
      await updateJob(jobId, item => ({
        ...item,
        visualOptions: [...(item.visualOptions ?? []), {
          id: optionId, batchId: batch.id, directionId: direction.id, createdAt: new Date().toISOString(),
          description: batch.description, preferences: batch.preferences,
          sourceDraftCreatedAt: batch.sourceDraftCreatedAt, sourceCopyCreatedAt: batch.sourceCopyCreatedAt,
          sourceDocumentVersionId: job.confirmedDocument?.documentVersionId ?? job.copyDraft!.createdAt,
          sourceDocument: job.copyDraft!.document, promptVersion: "visual-pair-v2-canvas", brief, actualPrompt: imageRequestPrompt(brief),
          assetPath: illustration.path, assetMode: illustration.mode, assetDetail: illustration.detail,
          imageProvider: illustration.provider, imageModel: illustration.model
        }],
        visualBatches: item.visualBatches?.map(b => b.id === batch.id ? { ...b, directions: b.directions.map(d => d.id === direction.id ? { ...d, status: "READY", optionId, error: undefined } : d) } : b)
      }));
    } catch (error) {
      await updateJob(jobId, item => ({ ...item, visualBatches: item.visualBatches?.map(b => b.id === batch.id ? { ...b, directions: b.directions.map(d => d.id === direction.id ? { ...d, status: "FAILED", error: error instanceof Error ? error.message : "图片生成失败" } : d) } : b) }));
    }
  }));
  await updateJob(jobId, item => ({ ...item, status: "READY_FOR_VISUAL_REVIEW", currentStep: "请选择主视觉方案；失败项可单独重试" }));
}
