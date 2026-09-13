import { NextResponse } from "next/server";
import { confirmVisualOptionSchema } from "@/contracts/poster";
import {
  claimJobAction,
  findJob,
  JobActionError
} from "@/server/job-store";
import { runSelectedVisualStage } from "@/worker/run-job";
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
      { error: { code: "INVALID_VISUAL_OPTION", message: body.message } },
      { status: 400 }
    );
  }
  const parsed = confirmVisualOptionSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_VISUAL_OPTION", message: "请选择有效的主视觉方案" } },
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
  if (job.userId !== identity.userId) return forbiddenResponse();
  if (job.actionIdempotencyKeys?.includes(parsed.data.idempotencyKey)) {
    return NextResponse.json(
      { jobId, status: job.status, reused: true },
      { status: 202 }
    );
  }
  const option = (job.visualOptions ?? []).find(
    (item) => item.id === parsed.data.optionId
  );
  if (
    job.status !== "READY_FOR_VISUAL_REVIEW" ||
    !option || option.sourceCopyCreatedAt !== job.copyDraft?.createdAt ||
    job.selectedVisualOptionId !== option.id
  ) {
    return NextResponse.json(
      { error: { code: "VISUAL_OPTION_NOT_READY", message: "请先选中要使用的主视觉方案" } },
      { status: 409 }
    );
  }
  try {
    await claimJobAction(
      jobId,
      parsed.data.idempotencyKey,
      ["READY_FOR_VISUAL_REVIEW"],
      (item) => {
        const selected = item.visualOptions?.find(
          (candidate) => candidate.id === parsed.data.optionId
        );
        if (!selected || selected.sourceCopyCreatedAt !== item.copyDraft?.createdAt || item.selectedVisualOptionId !== selected.id) {
          throw new JobActionError("STALE_ACTION", "主视觉选择已变化，请重新确认");
        }
        return {
          ...item,
          actionIdempotencyKeys: [
            ...(item.actionIdempotencyKeys ?? []),
            parsed.data.idempotencyKey
          ],
          status: "RENDERING",
          currentStep: "主视觉已确认，正在排版",
          confirmedVisualOptionId: undefined,
          error: undefined
        };
      }
    );
  } catch (error) {
    if (error instanceof JobActionError) {
      return NextResponse.json(
        { error: { code: "VISUAL_OPTION_NOT_READY", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
  void runSelectedVisualStage(jobId, option.id);
  return NextResponse.json({ jobId, status: "RENDERING" }, { status: 202 });
}
