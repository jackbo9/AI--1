import { NextResponse } from "next/server";
import { confirmVisualSchema } from "@/contracts/poster";
import { claimJobAction, findJob, JobActionError } from "@/server/job-store";
import { runVisualStage } from "@/worker/run-job";
import {
  forbiddenResponse,
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const parsed = confirmVisualSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_VISUAL_CONFIRMATION", message: parsed.error.issues[0]?.message ?? "主视觉描述有误" } },
      { status: 400 }
    );
  }
  const { jobId } = await context.params;
  const job = await findJob(jobId);
  if (!job) return NextResponse.json({ error: { code: "JOB_NOT_FOUND", message: "未找到该任务" } }, { status: 404 });
  if (job.userId !== identity.userId) return forbiddenResponse();
  if (job.actionIdempotencyKeys?.includes(parsed.data.idempotencyKey)) {
    return NextResponse.json({ jobId, status: job.status, reused: true }, { status: 202 });
  }
  if (job.status !== "READY_FOR_VISUAL_REVIEW" || !job.visualDraft || !job.confirmedDocument) {
    return NextResponse.json({ error: { code: "VISUAL_NOT_READY", message: "当前任务尚不能确认主视觉" } }, { status: 409 });
  }
  if (
    job.visualDraft.createdAt !== parsed.data.sourceDraftCreatedAt ||
    job.visualDraft.sourceCopyCreatedAt !== job.copyDraft?.createdAt
  ) {
    return NextResponse.json({ error: { code: "STALE_VISUAL_DRAFT", message: "画面描述已过期，请重新优化" } }, { status: 409 });
  }
  let claimedJob;
  try {
    claimedJob = await claimJobAction(jobId, parsed.data.idempotencyKey, ["READY_FOR_VISUAL_REVIEW"], (item) => {
      if (!item.visualDraft || item.visualDraft.createdAt !== parsed.data.sourceDraftCreatedAt || item.visualDraft.sourceCopyCreatedAt !== item.copyDraft?.createdAt) {
        throw new JobActionError("STALE_ACTION", "画面描述已过期，请重新优化");
      }
      return {
        ...item,
        actionIdempotencyKeys: [...(item.actionIdempotencyKeys ?? []), parsed.data.idempotencyKey],
        status: "GENERATING_ASSET",
        currentStep: "已确认主视觉，准备生成图片",
        confirmedVisual: {
          description: parsed.data.description,
          sourceDraftCreatedAt: parsed.data.sourceDraftCreatedAt,
          createdAt: new Date().toISOString()
        },
        error: undefined
      };
    });
  } catch (error) {
    if (error instanceof JobActionError && error.code === "STALE_ACTION") {
      return NextResponse.json({ error: { code: "STALE_VISUAL_DRAFT", message: error.message } }, { status: 409 });
    }
    if (error instanceof JobActionError) {
      return NextResponse.json({ error: { code: "VISUAL_NOT_READY", message: "当前任务尚不能确认主视觉" } }, { status: 409 });
    }
    throw error;
  }
  void runVisualStage(jobId, claimedJob.copyDraft!.document, parsed.data.description);
  return NextResponse.json({ jobId, status: "GENERATING_ASSET" }, { status: 202 });
}
