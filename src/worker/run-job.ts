import crypto from "node:crypto";
import type { PosterDocument } from "@/contracts/poster";
import { generateCopy } from "@/providers/copy-provider";
import { compileIllustrationBrief } from "@/providers/prompt-compiler";
import { generateIllustration } from "@/providers/illustration-provider";
import { ProviderError } from "@/providers/provider-error";
import {
  renderEmployeeActivity,
  employeeActivityTemplate
} from "@/templates/employee-activity";
import { validatePoster } from "@/validation/poster-validation";
import { findJob, updateJob } from "@/server/job-store";

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

    const copy = await generateCopy(job.input);
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

export async function runVisualStage(
  jobId: string,
  document: PosterDocument
) {
  try {
    const job = await findJob(jobId);
    if (!job || job.status !== "GENERATING_ASSET") return;

    await updateJob(jobId, (item) => ({
      ...item,
      currentStep: "编译受控主视觉描述",
      error: undefined
    }));
    const compiler = await compileIllustrationBrief(job.input);

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
    const outputPath = await renderEmployeeActivity(
      document,
      illustration.path,
      outputId
    );
    const validation = validatePoster(job.input, document);

    await updateJob(jobId, (item) => ({
      ...item,
      status: "VALIDATING_OUTPUT",
      currentStep: "校验成品"
    }));
    await updateJob(jobId, (item) => ({
      ...item,
      status: "READY_FOR_REVIEW",
      currentStep: "等待预览确认",
      versions: [
        ...item.versions,
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
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
          assetMode: illustration.mode,
          assetDetail: illustration.detail,
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

async function failJob(jobId: string, error: unknown) {
  const code =
    error instanceof ProviderError ? error.code : "GENERATION_FAILED";
  const message =
    error instanceof Error ? error.message : "生成任务未完成，请重试";

  await updateJob(jobId, (item) => ({
    ...item,
    status: "FAILED_FINAL",
    currentStep: "生成失败",
    error: { code, message }
  }));
}
