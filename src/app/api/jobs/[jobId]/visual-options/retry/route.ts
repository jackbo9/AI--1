import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiIdentity, unauthorizedResponse, forbiddenResponse } from "@/server/auth";
import { findJob, claimJobAction } from "@/server/job-store";
import { readJsonRequest } from "@/server/request-json";
import { runVisualBatch } from "@/worker/visual-batch";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const body = await readJsonRequest(request);
  const parsed = z.object({ batchId: z.string().uuid(), directionId: z.string().uuid(), idempotencyKey: z.string().uuid() }).safeParse(body.ok ? body.value : undefined);
  if (!parsed.success) return NextResponse.json({ error: { message: "重试参数有误" } }, { status: 400 });
  const { jobId } = await context.params;
  const job = await findJob(jobId);
  if (!job) return NextResponse.json({ error: { message: "任务不存在" } }, { status: 404 });
  if (job.userId !== identity.userId) return forbiddenResponse();
  if (job.actionIdempotencyKeys.includes(parsed.data.idempotencyKey)) return NextResponse.json({ reused: true });
  try {
    await claimJobAction(jobId, parsed.data.idempotencyKey, ["READY_FOR_VISUAL_REVIEW"], item => {
      const batch = item.visualBatches?.find(b => b.id === parsed.data.batchId);
      if (batch?.sourceCopyCreatedAt !== item.copyDraft?.createdAt || !batch?.directions.some(d => d.id === parsed.data.directionId && d.status === "FAILED")) throw new Error("该方案不能重试");
      return { ...item, status: "GENERATING_ASSET", actionIdempotencyKeys: [...item.actionIdempotencyKeys, parsed.data.idempotencyKey], error: undefined };
    });
  } catch {
    return NextResponse.json({ error: { message: "方案正在处理或已失效，请刷新后重试" } }, { status: 409 });
  }
  void runVisualBatch(jobId, parsed.data);
  return NextResponse.json({ status: "GENERATING_ASSET" }, { status: 202 });
}
