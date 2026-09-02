import { NextResponse } from "next/server";
import {
  confirmCopySchema,
  posterDocumentSchema
} from "@/contracts/poster";
import { findJob, updateJob } from "@/server/job-store";
import { runVisualStage } from "@/worker/run-job";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const parsed = confirmCopySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_COPY",
          message: parsed.error.issues[0]?.message ?? "文案内容有误"
        }
      },
      { status: 400 }
    );
  }

  const { jobId } = await context.params;
  const job = await findJob(jobId);
  if (!job) {
    return NextResponse.json(
      { error: { code: "JOB_NOT_FOUND", message: "未找到该任务" } },
      { status: 404 }
    );
  }
  if (job.actionIdempotencyKeys?.includes(parsed.data.idempotencyKey)) {
    return NextResponse.json(
      { jobId, status: job.status, reused: true },
      { status: 202 }
    );
  }
  if (job.status !== "READY_FOR_COPY_REVIEW" || !job.copyDraft) {
    return NextResponse.json(
      {
        error: {
          code: "COPY_NOT_READY",
          message: "当前任务尚不能确认文案"
        }
      },
      { status: 409 }
    );
  }

  const document = posterDocumentSchema.parse({
    ...job.copyDraft.document,
    ...parsed.data.content,
    outputFormat: job.input.outputFormat,
    sessions: job.input.sessions,
    notice: job.input.notice,
    includeQr: job.input.includeQr,
    ctaLabel: job.input.ctaLabel,
    qrPayload: job.input.qrPayload,
    contact: job.input.contact
  });

  await updateJob(jobId, (item) => ({
    ...item,
    actionIdempotencyKeys: [
      ...(item.actionIdempotencyKeys ?? []),
      parsed.data.idempotencyKey
    ],
    status: "GENERATING_ASSET",
    currentStep: "已确认文案，准备生成主视觉",
    copyDraft: { ...item.copyDraft!, document },
    error: undefined
  }));
  void runVisualStage(jobId, document);

  return NextResponse.json(
    { jobId, status: "GENERATING_ASSET" },
    { status: 202 }
  );
}
