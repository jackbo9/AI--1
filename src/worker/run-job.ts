import crypto from "node:crypto";
import { generateCopy } from "@/providers/copy-provider";
import { compileIllustrationBrief } from "@/providers/prompt-compiler";
import { generateIllustration } from "@/providers/illustration-provider";
import { renderEmployeeActivity, employeeActivityTemplate } from "@/templates/employee-activity";
import { validatePoster } from "@/validation/poster-validation";
import { findJob, updateJob } from "@/server/job-store";
import { serverEnv } from "@/lib/env";

export async function runJob(jobId: string) { try { const job = await findJob(jobId); if (!job || job.status !== "QUEUED") return;
  await updateJob(jobId, (item) => ({ ...item, status: "VALIDATING_INPUT", currentStep: "校验活动信息" }));
  await updateJob(jobId, (item) => ({ ...item, status: "GENERATING_COPY", currentStep: "DeepSeek 生成结构化文案" })); const copy = await generateCopy(job.input);
  await updateJob(jobId, (item) => ({ ...item, status: "GENERATING_ASSET", currentStep: "编译受控主视觉描述" })); const compiler = await compileIllustrationBrief(job.input);
  await updateJob(jobId, (item) => ({ ...item, currentStep: "Seedream 生成无文字主视觉" })); const illustration = await generateIllustration(compiler.brief, jobId);
  await updateJob(jobId, (item) => ({ ...item, status: "RENDERING", currentStep: "合成受控海报" })); const outputPath = await renderEmployeeActivity(copy.document, illustration.path, jobId); const validation = validatePoster(job.input, copy.document);
  await updateJob(jobId, (item) => ({ ...item, status: "VALIDATING_OUTPUT", currentStep: "校验成品" }));
  await updateJob(jobId, (item) => ({ ...item, status: "READY_FOR_REVIEW", currentStep: "等待预览确认", versions: [...item.versions, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), posterDocument: copy.document, templateVersion: employeeActivityTemplate.version, promptVersion: "employee-activity-copy-v1-5", illustrationPromptVersion: compiler.promptVersion, modelInfo: { copyProvider: copy.provider, copyModel: serverEnv.LLM_MODEL ?? "demo-copy", compilerProvider: compiler.provider, imageProvider: illustration.provider, imageModel: illustration.model }, assetMode: illustration.mode, assetDetail: illustration.detail, outputPath, validation }] }));
} catch (error) { await updateJob(jobId, (item) => ({ ...item, status: "FAILED_FINAL", currentStep: "生成失败", error: { code: "GENERATION_FAILED", message: error instanceof Error ? error.message : "生成任务未完成，请重试" } })); } }
