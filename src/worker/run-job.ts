import crypto from "node:crypto";
import {
  legacyPortraitInputFromCampaignBrief,
  type IllustrationBrief,
  visualMasterSchema,
  type PosterDocument,
  type VisualPreference
} from "@/contracts/poster";
import { generateCopy } from "@/providers/copy-provider";
import {
  briefFromConfirmedDescription,
  compileIllustrationBrief
} from "@/providers/prompt-compiler";
import {
  generateIllustration,
  seedreamPrompt
} from "@/providers/illustration-provider";
import { ProviderError } from "@/providers/provider-error";
import {
  renderEmployeeActivity,
  preflightEmployeeActivity,
  employeeActivityTemplate,
  PosterRenderError
} from "@/templates/employee-activity";
import { validatePoster } from "@/validation/poster-validation";
import { findJob, updateJob } from "@/server/job-store";
import { activityTemplateFamilyManifest } from "@/templates/activity-template-family";
import { serverEnv } from "@/lib/env";
import { readOwnedQrAssetDataUri } from "@/server/qr-asset-store";
import { claimFormat, renderClaimedFormat } from "@/server/t01-format-service";

export async function runCopyStage(jobId: string) {
  try {
    const job = await findJob(jobId);
    if (!job || job.status !== "QUEUED") return;

    await updateJob(jobId, (item) => ({
      ...item,
      status: "VALIDATING_INPUT",
      currentStep: "校验活动信息",
      error: undefined
    }));
    await updateJob(jobId, (item) => ({
      ...item,
      status: "GENERATING_COPY",
      currentStep: "DeepSeek 生成结构化文案"
    }));

    const input = legacyPortraitInputFromCampaignBrief(job.campaignBrief);
    const copy = await generateCopy(input);
    await updateJob(jobId, (item) => ({
      ...item,
      status: "READY_FOR_COPY_REVIEW",
      currentStep: "等待确认文案",
      copyDraft: {
        document: copy.document,
        provider: copy.provider,
        model: copy.model,
        promptVersion: copy.promptVersion,
        createdAt: new Date().toISOString()
      }
    }));
  } catch (error) {
    await failJob(jobId, error);
  }
}

export async function runVisualRefinement(
  jobId: string,
  visualIntent: string,
  preferences?: VisualPreference,
  mode?: "initial" | "regenerate",
  sportType?: import("@/contracts/poster").EmployeeActivityInput["sportType"]
) {
  try {
    const job = await findJob(jobId);
    if (
      !job ||
      !job.campaignBrief ||
      !["READY_FOR_VISUAL_INPUT", "REFINING_VISUAL", "READY_FOR_VISUAL_REVIEW"].includes(job.status)
    ) {
      return;
    }
    const sourceCopyCreatedAt = job.copyDraft?.createdAt;
    if (!sourceCopyCreatedAt) throw new Error("文案版本已失效，请返回重新确认文案");

    await updateJob(jobId, (item) => ({
      ...item,
      status: "REFINING_VISUAL",
      currentStep: "AI 优化画面描述",
      visualInput: {
        originalIntent: visualIntent,
        sourceCopyCreatedAt,
        createdAt: new Date().toISOString(),
        preferences
      },
      error: undefined
    }));

    const input = legacyPortraitInputFromCampaignBrief(job.campaignBrief);
    const compiler = await compileIllustrationBrief({
      ...input,
      activityName: job.copyDraft?.document.title ?? input.activityName,
      slogan: job.copyDraft?.document.slogan ?? input.slogan,
      subtitle: job.copyDraft?.document.subtitle ?? input.subtitle,
      sportType: sportType ?? input.sportType,
      ...preferences,
      visualIntent
    });
    if (compiler.provider !== "deepseek") throw new ProviderError("LLM_REQUEST_FAILED", "主视觉 Prompt 生成暂不可用，已保留当前文字，请稍后重试", true);
    const description = visualDescriptionFromBrief(compiler.brief);
    const createdAt = new Date().toISOString();
    await updateJob(jobId, (item) => ({
      ...item,
      status: "READY_FOR_VISUAL_REVIEW",
      currentStep: "等待确认主视觉描述",
      visualDraft: {
        mode,
        sportType,
        preferences,
        description,
        brief: compiler.brief,
        provider: compiler.provider,
        promptVersion: compiler.promptVersion,
        sourceCopyCreatedAt,
        createdAt,
        fallback: compiler.provider !== "deepseek"
      }
    }));
  } catch (error) {
    await updateJob(jobId, (item) => {
      const createdAt = new Date().toISOString();
      const visualDraft = mode ? item.visualDraft : item.visualDraft
        ? {
            ...item.visualDraft,
            description:
              item.visualInput?.originalIntent ?? item.visualDraft.description,
            provider: "saved-user-description",
            sourceCopyCreatedAt:
              item.copyDraft?.createdAt ?? item.visualDraft.sourceCopyCreatedAt,
            createdAt,
            fallback: true
          }
        : undefined;
      return {
        ...item,
        status: visualDraft ? "READY_FOR_VISUAL_REVIEW" : "READY_FOR_VISUAL_INPUT",
        currentStep: "画面描述优化失败，已保留当前文字",
        visualDraft,
        error: {
          code: error instanceof ProviderError ? error.code : "VISUAL_REFINEMENT_FAILED",
          message: error instanceof Error ? error.message : "画面描述优化失败，请重试"
        }
      };
    });
  }
}

export async function runVisualStage(
  jobId: string,
  document: PosterDocument,
  confirmedDescription: string
) {
  try {
    const job = await findJob(jobId);
    if (!job || job.status !== "GENERATING_ASSET") return;

    await updateJob(jobId, (item) => ({
      ...item,
      currentStep: "编译受控主视觉描述",
      error: undefined
    }));
    const input = legacyPortraitInputFromCampaignBrief(job.campaignBrief);
    const brief = briefFromConfirmedDescription(confirmedDescription, {
      ...input,
      ...(job.confirmedVisual?.preferences ?? job.visualInput?.preferences)
    });
    // Validate the final provider payload before any paid image request.
    seedreamPrompt(brief);
    const compiler = {
      brief,
      provider: "confirmed-visual",
      promptVersion: `visual-confirmed-v4-people-${brief.visualStyleMode}`
    };
    const documentVersionId =
      job.confirmedDocument?.documentVersionId ??
      job.versions.at(-1)?.id ??
      crypto.randomUUID();

    await updateJob(jobId, (item) => ({
      ...item,
      currentStep: "图片模型生成无文字主视觉"
    }));
    const assetId = `${jobId}-${crypto.randomUUID()}`;
    const illustration = await generateIllustration(compiler.brief, assetId);
    const optionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await updateJob(jobId, (item) => ({
      ...item,
      status: "READY_FOR_VISUAL_REVIEW",
      currentStep: "主视觉方案已生成，等待选择",
      visualOptions: [
        ...(item.visualOptions ?? []),
        {
          id: optionId,
          createdAt,
          description: confirmedDescription,
          preferences: job.confirmedVisual?.preferences ?? job.visualInput?.preferences,
          sourceDraftCreatedAt:
            item.confirmedVisual?.sourceDraftCreatedAt ??
            job.confirmedVisual?.sourceDraftCreatedAt ??
            item.visualDraft?.createdAt ??
            createdAt,
          sourceCopyCreatedAt:
            item.copyDraft?.createdAt ?? job.copyDraft?.createdAt ?? createdAt,
          sourceDocumentVersionId: documentVersionId,
          sourceDocument: document,
          promptVersion: compiler.promptVersion,
          brief: compiler.brief,
          assetPath: illustration.path,
          assetMode: illustration.mode,
          assetDetail: illustration.detail,
          imageProvider: illustration.provider,
          imageModel: illustration.model
        }
      ],
      selectedVisualOptionId: optionId,
      error: undefined
    }));
  } catch (error) {
    await failVisualGeneration(jobId, error);
  }
}

export async function runSelectedVisualStage(
  jobId: string,
  optionId: string
) {
  try {
    const job = await findJob(jobId);
    if (!job || job.status !== "RENDERING") return;
    const option = job.visualOptions?.find((item) => item.id === optionId);
    if (!option) throw new Error("选中的主视觉方案不存在");
    if (option.sourceCopyCreatedAt !== job.copyDraft?.createdAt) {
      throw new Error("选中的主视觉来源文案已失效，请重新生成");
    }

    const document = option.sourceDocument;
    const input = legacyPortraitInputFromCampaignBrief(job.campaignBrief);
    const qrDataUri = document.qrAssetId
      ? await readOwnedQrAssetDataUri(document.qrAssetId, job.userId)
      : undefined;
    await preflightEmployeeActivity(document, { qrDataUri });
    const visualMasterId = crypto.randomUUID();
    const visualFamilyId = crypto.randomUUID();

    await updateJob(jobId, (item) => ({
      ...item,
      currentStep: "使用选中的主视觉合成海报",
      error: undefined
    }));
    const outputId = `${jobId}-${crypto.randomUUID()}`;
    const rendered = await renderEmployeeActivity(
      document,
      option.assetPath,
      outputId,
      { readabilityMode: serverEnv.READABILITY_MODE, qrDataUri, fullCanvas: Boolean(option.brief.canvasTarget) }
    );
    const outputPath = rendered.outputPath;
    const posterValidation = validatePoster(input, document);
    const validation = {
      passed: posterValidation.passed && rendered.readability.passed,
      exportAllowed: posterValidation.passed,
      strategy: serverEnv.READABILITY_MODE,
      checks: {
        fontAndLogos: true,
        capacity: true,
        outputSize: true
      },
      messages: [
        ...posterValidation.messages,
        "T01 可读性：" +
          (rendered.readability.passed ? "通过" : "未通过") +
          "；Logo " +
          rendered.readability.logoVariant +
          "；背景 " +
          rendered.readability.backgroundMode +
          "。"
      ],
      readability: rendered.readability
    };
    const finalAssetMode = option.assetMode;
    const finalAssetDetail = option.assetDetail;
    const artifactId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const portraitTarget =
      activityTemplateFamilyManifest.renderTargets.portrait_1080x1920;
    const dimensions = portraitTarget.dimensions;
    if (dimensions.heightMode !== "fixed") {
      throw new Error("竖版 RenderTarget 尺寸配置无效");
    }
    const visualMaster = visualMasterSchema.parse({
      id: visualMasterId,
      visualFamilyId,
      sourceDocumentVersionId: option.sourceDocumentVersionId,
      promptVersion: option.promptVersion,
      brief: option.brief,
      assets: [
        {
          renderTargetId: "portrait_1080x1920",
          path: option.assetPath,
          mode: option.assetMode
        }
      ]
    });

    await updateJob(jobId, (item) => ({
      ...item,
      status: "VALIDATING_OUTPUT",
      currentStep: "校验成品"
    }));
    await updateJob(jobId, (item) => ({
      ...item,
      status: "READY_FOR_REVIEW",
      currentStep: "等待预览确认",
      visualMaster,
      selectedVisualOptionId: option.id,
      confirmedVisualOptionId: option.id,
      confirmedVisual: {
        description: option.description,
        sourceDraftCreatedAt: option.sourceDraftCreatedAt,
        sourceCopyCreatedAt: option.sourceCopyCreatedAt,
        createdAt
      },
      artifacts: [
        ...item.artifacts,
        {
          id: artifactId,
          renderTargetId: "portrait_1080x1920",
          status: "READY",
          createdAt,
          brandSpecVersion: 1,
          documentVersionId: option.sourceDocumentVersionId,
          visualFamilyId,
          width: dimensions.width,
          heightMode: "fixed",
          height: dimensions.height,
          templateId: employeeActivityTemplate.id,
          templateVersion: employeeActivityTemplate.version,
          assetMode: finalAssetMode,
          assetDetail: finalAssetDetail,
          assetPath: option.assetPath,
          outputPath,
          adaptationMode: "template-crop-v1",
          sourceVisualOptionId: option.id,
          validation
        }
      ],
      versions: [
        ...item.versions,
        {
          id: crypto.randomUUID(),
          createdAt,
          posterDocument: document,
          outputFormat: document.outputFormat,
          templateVersion: employeeActivityTemplate.version,
          promptVersion:
            item.copyDraft?.promptVersion ?? "employee-activity-copy-v1-6",
          illustrationPromptVersion: option.promptVersion,
          modelInfo: {
            copyProvider: item.copyDraft?.provider ?? "confirmed-copy",
            copyModel: item.copyDraft?.model ?? "confirmed-copy",
            compilerProvider: "confirmed-visual",
            imageProvider: option.imageProvider,
            imageModel: option.imageModel
          },
          assetMode: finalAssetMode,
          assetDetail: finalAssetDetail,
          assetPath: option.assetPath,
          outputPath,
          validation
        }
      ]
    }));
    const selectedExtraFormats = job.campaignBrief.renderTargets.filter(
      (target): target is "landscape_1920x1080" | "banner_2227x950" | "longform_1080xAuto" => target !== "portrait_1080x1920"
    );
    for (const format of selectedExtraFormats) {
      const claim = await claimFormat(jobId, job.userId, format);
      if (claim.claimed) void renderClaimedFormat(jobId, claim.artifact.id, format, claim.sourceDocument);
    }
  } catch (error) {
    await failSelectedVisualRender(jobId, error);
  }
}

async function failVisualGeneration(jobId: string, error: unknown) {
  const code =
    error instanceof ProviderError || error instanceof PosterRenderError
      ? error.code
      : "GENERATION_FAILED";
  const message =
    error instanceof Error ? error.message : "主视觉生成未完成，请重试";
  await updateJob(jobId, (item) => ({
    ...item,
    status: "READY_FOR_VISUAL_REVIEW",
    currentStep: (item.visualOptions?.length ?? 0)
      ? "新方案生成失败，已保留此前方案"
      : "主视觉生成失败，可使用当前描述重试",
    error: { code, message }
  }));
}

async function failSelectedVisualRender(jobId: string, error: unknown) {
  const code =
    error instanceof ProviderError || error instanceof PosterRenderError
      ? error.code
      : "RENDER_FAILED";
  const message =
    error instanceof Error ? error.message : "海报排版未完成，请重试";
  await updateJob(jobId, (item) => ({
    ...item,
    status: "READY_FOR_VISUAL_REVIEW",
    currentStep: "海报排版失败，已保留全部主视觉方案",
    confirmedVisualOptionId: undefined,
    error: { code, message }
  }));
}

function visualDescriptionFromBrief(brief: IllustrationBrief) {
  const description = [
    `主体：${brief.subject}`,
    `动作：${brief.action}`,
    `环境：${brief.setting}`,
    `构图：${brief.composition.replace(/原生竖版 9:16。?/, "").trim()}`,
    `风格：${brief.style}`,
    `颜色：${brief.palette}`,
    `氛围：${brief.mood}`
  ].join("\n");
  // Preserve the editable creative description intact when labels would push
  // it beyond the confirmation contract; never silently truncate it.
  if (description.length > 420) {
    throw new ProviderError("LLM_INVALID_OUTPUT", "优化后的画面描述过长，请精简画面想法后重试", false);
  }
  return description;
}

async function failJob(jobId: string, error: unknown) {
  const code =
    error instanceof ProviderError || error instanceof PosterRenderError
      ? error.code
      : "GENERATION_FAILED";
  const message =
    error instanceof Error ? error.message : "生成任务未完成，请重试";

  await updateJob(jobId, (item) => ({
    ...item,
    status: "FAILED_FINAL",
    currentStep: "生成失败",
    error: { code, message }
  }));
}
