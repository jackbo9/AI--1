import { NextResponse } from "next/server";
import { refineVisualSchema } from "@/contracts/poster";
import { findJob, updateJob } from "@/server/job-store";
import { runVisualRefinement } from "@/worker/run-job";
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
  const parsed = refineVisualSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_VISUAL_INPUT", message: parsed.error.issues[0]?.message ?? "画面描述有误" } },
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
  if (!["READY_FOR_VISUAL_INPUT", "READY_FOR_VISUAL_REVIEW"].includes(job.status)) {
    return NextResponse.json({ error: { code: "VISUAL_NOT_READY", message: "当前任务尚不能优化画面描述" } }, { status: 409 });
  }
  await updateJob(jobId, (item) => ({
    ...item,
    actionIdempotencyKeys: [...(item.actionIdempotencyKeys ?? []), parsed.data.idempotencyKey],
    status: "REFINING_VISUAL",
    currentStep: "准备优化画面描述",
    visualInput: {
      originalIntent: parsed.data.visualIntent,
      sourceCopyCreatedAt: item.copyDraft?.createdAt ?? "",
      createdAt: new Date().toISOString()
    },
    error: undefined
  }));
  void runVisualRefinement(jobId, parsed.data.visualIntent);
  return NextResponse.json({ jobId, status: "REFINING_VISUAL" }, { status: 202 });
}
