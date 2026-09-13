import { NextResponse } from "next/server";
import { isRecognizedSportsActivity, refineVisualSchema } from "@/contracts/poster";
import { claimJobAction, findJob, JobActionError } from "@/server/job-store";
import { runVisualRefinement } from "@/worker/run-job";
import {
  forbiddenResponse,
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";
import { readJsonRequest } from "@/server/request-json";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const body = await readJsonRequest(request);
  if (!body.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_VISUAL_INPUT", message: body.message } },
      { status: 400 }
    );
  }
  const parsed = refineVisualSchema.safeParse(body.value);
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
  if (parsed.data.sourceCopyCreatedAt && parsed.data.sourceCopyCreatedAt !== job.copyDraft?.createdAt) return NextResponse.json({ error: { code: "STALE_VISUAL_DRAFT", message: "文案已变化，请重新生成描述" } }, { status: 409 });
  if (parsed.data.mode && (!parsed.data.sportType || parsed.data.sportType === "auto") && !isRecognizedSportsActivity([job.copyDraft?.document.title, job.copyDraft?.document.slogan, job.copyDraft?.document.subtitle, job.copyDraft?.document.rules].join(" "))) return NextResponse.json({ error: { message: "请先选择赛事类型" } }, { status: 422 });
  if (job.status === "REFINING_VISUAL") {
    return NextResponse.json({ jobId, status: job.status, reused: true }, { status: 202 });
  }
  if (job.actionIdempotencyKeys?.includes(parsed.data.idempotencyKey)) {
    return NextResponse.json({ jobId, status: job.status, reused: true }, { status: 202 });
  }
  if (!["READY_FOR_VISUAL_INPUT", "READY_FOR_VISUAL_REVIEW"].includes(job.status)) {
    return NextResponse.json({ error: { code: "VISUAL_NOT_READY", message: "当前任务尚不能优化画面描述" } }, { status: 409 });
  }
  try {
    await claimJobAction(jobId, parsed.data.idempotencyKey, ["READY_FOR_VISUAL_INPUT", "READY_FOR_VISUAL_REVIEW"], (item) => {
      if (parsed.data.sourceCopyCreatedAt && parsed.data.sourceCopyCreatedAt !== item.copyDraft?.createdAt) throw new JobActionError("STALE_ACTION", "文案已变化");
      return {
      ...item,
      input: parsed.data.sportType ? { ...item.input, sportType: parsed.data.sportType, sportsConfirmed: true } : item.input,
      actionIdempotencyKeys: [...(item.actionIdempotencyKeys ?? []), parsed.data.idempotencyKey],
      status: "REFINING_VISUAL",
      currentStep: "准备优化画面描述",
      visualInput: {
        originalIntent: parsed.data.visualIntent,
        sourceCopyCreatedAt: item.copyDraft?.createdAt ?? "",
        createdAt: new Date().toISOString(),
        preferences: parsed.data.preferences
      },
      error: undefined
    }; });
  } catch (error) {
    if (error instanceof JobActionError && error.code === "ACTION_REUSED") {
      return NextResponse.json({ jobId, status: job.status, reused: true }, { status: 202 });
    }
    if (error instanceof JobActionError) {
      return NextResponse.json({ error: { code: "VISUAL_NOT_READY", message: "当前任务尚不能优化画面描述，请返回任务后重试" } }, { status: 409 });
    }
    throw error;
  }
  void runVisualRefinement(jobId, parsed.data.visualIntent, parsed.data.preferences, parsed.data.mode, parsed.data.sportType);
  return NextResponse.json({ jobId, status: "REFINING_VISUAL" }, { status: 202 });
}
