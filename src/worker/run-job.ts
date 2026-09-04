import crypto from "node:crypto";
import {
  legacyPortraitInputFromCampaignBrief,
  type IllustrationBrief,
  visualMasterSchema,
  type PosterDocument
} from "@/contracts/poster";
import { generateCopy } from "@/providers/copy-provider";
import {
  briefFromConfirmedDescription,
  compileIllustrationBrief
} from "@/providers/prompt-compiler";
import { generateIllustration } from "@/providers/illustration-provider";
import { ProviderError } from "@/providers/provider-error";
import {
  renderEmployeeActivity,
  employeeActivityTemplate,
  PosterRenderError
} from "@/templates/employee-activity";
import { validatePoster } from "@/validation/poster-validation";
import { findJob, updateJob } from "@/server/job-store";
import { activityTemplateFamilyManifest } from "@/templates/activity-template-family";
import { serverEnv } from "@/lib/env";

export async function runJob(jobId: string) {
  await runCopyStage(jobId);
}

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

export async function runVisualRefinement(jobId: string, visualIntent: string) {
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
        createdAt: new Date().toISOString()
      },
      error: undefined
    }));

    const input = legacyPortraitInputFromCampaignBrief(job.campaignBrief);
    const compiler = await compileIllustrationBrief({
      category: input.category,
      themeKeywords: input.themeKeywords,
      visualIntent
    });
    const description = visualDescriptionFromBrief(compiler.brief);
    const createdAt = new Date().toISOString();
    await updateJob(jobId, (item) => ({
      ...item,
      status: "READY_FOR_VISUAL_REVIEW",
      currentStep: "等待确认主视觉描述",
      visualDraft: {
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
    await updateJob(jobId, (item) => ({
      ...item,
      status: "READY_FOR_VISUAL_INPUT",
      currentStep: "画面描述优化失败，可重试",
      error: {
        code: error instanceof ProviderError ? error.code : "VISUAL_REFINEMENT_FAILED",
        message: error instanceof Error ? error.message : "画面描述优化失败，请重试"
      }
    }));
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
    const brief = briefFromConfirmedDescription(confirmedDescription, input);
    const compiler = {
      brief,
      provider: "confirmed-visual",
      promptVersion: "visual-confirmed-v1"
    };
    const documentVersionId =
      job.confirmedDocument?.documentVersionId ??
      job.versions.at(-1)?.id ??
      crypto.randomUUID();
    const visualMasterId = crypto.randomUUID();
    const visualFamilyId = crypto.randomUUID();

    await updateJob(jobId, (item) => ({
      ...item,
      currentStep: "Seedream 生成无文字主视觉"
    }));
    const assetId = `${jobId}-${crypto.randomUUID()}`;
    const illustration = await generateIllustration(compiler.brief, assetId);

    await updateJob(jobId, (item) => ({
      ...item,
      status: "RENDERING",
      currentStep: "合成受控海报"
    }));
    const outputId = `${jobId}-${crypto.randomUUID()}`;
    const rendered = await renderEmployeeActivity(
      document,
      illustration.path,
      outputId,
      { readabilityMode: serverEnv.READABILITY_MODE }
    );
    const outputPath = rendered.outputPath;
    const posterValidation = validatePoster(input, document);
    const validation = {
      passed: posterValidation.passed && rendered.readability.passed,
      exportAllowed:
        posterValidation.passed &&
        (rendered.readability.passed || serverEnv.READABILITY_MODE === "trial"),
      strategy: serverEnv.READABILITY_MODE,
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
    if (!validation.exportAllowed) {
      throw new PosterRenderError(
        "brand.readability.contrast_failed",
        "T01 对比度发布门未通过，Artifact 不会进入 READY。"
      );
    }
    const finalAssetMode =
      rendered.readability.backgroundMode === "fallback"
        ? "fallback"
        : illustration.mode;
    const finalAssetDetail =
      rendered.readability.backgroundMode === "fallback"
        ? "Seedream 主视觉已生成，但未通过 T01 图文可读性门禁；成品已改用极简品牌降级背景。"
        : illustration.detail;
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
      sourceDocumentVersionId: documentVersionId,
      promptVersion: compiler.promptVersion,
      brief: compiler.brief,
      assets: [
        {
          renderTargetId: "portrait_1080x1920",
          path: illustration.path,
          mode: illustration.mode
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
      artifacts: [
        ...item.artifacts,
        {
          id: artifactId,
          renderTargetId: "portrait_1080x1920",
          status: "READY",
          createdAt,
          brandSpecVersion: 1,
          documentVersionId,
          visualFamilyId,
          width: dimensions.width,
          heightMode: "fixed",
          height: dimensions.height,
          templateId: employeeActivityTemplate.id,
          templateVersion: employeeActivityTemplate.version,
          assetMode: finalAssetMode,
          assetDetail: finalAssetDetail,
          assetPath: illustration.path,
          outputPath,
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
          illustrationPromptVersion: compiler.promptVersion,
          modelInfo: {
            copyProvider: item.copyDraft?.provider ?? "confirmed-copy",
            copyModel: item.copyDraft?.model ?? "confirmed-copy",
            compilerProvider: compiler.provider,
            imageProvider: illustration.provider,
            imageModel: illustration.model
          },
          assetMode: finalAssetMode,
          assetDetail: finalAssetDetail,
          assetPath: illustration.path,
          outputPath,
          validation
        }
      ]
    }));
  } catch (error) {
    await failJob(jobId, error);
  }
}

function visualDescriptionFromBrief(brief: IllustrationBrief) {
  return [
    `主体：${brief.subject}`,
    `动作：${brief.action}`,
    `环境：${brief.setting}`,
    `构图：${brief.composition.replace(/原生竖版 9:16。?/, "").trim()}`,
    `风格：${brief.style}`,
    `氛围：${brief.mood}`
  ].join("\n");
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
