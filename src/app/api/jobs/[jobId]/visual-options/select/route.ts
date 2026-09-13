import { NextResponse } from "next/server";
import { selectVisualOptionSchema } from "@/contracts/poster";
import { findJob, updateJob } from "@/server/job-store";
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
  const parsed = selectVisualOptionSchema.safeParse(body.value);
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
  if (job.status !== "READY_FOR_VISUAL_REVIEW") {
    return NextResponse.json(
      { error: { code: "VISUAL_NOT_READY", message: "当前不能切换主视觉方案" } },
      { status: 409 }
    );
  }
  if (!(job.visualOptions ?? []).some((option) => option.id === parsed.data.optionId && option.sourceCopyCreatedAt === job.copyDraft?.createdAt)) {
    return NextResponse.json(
      { error: { code: "VISUAL_OPTION_NOT_FOUND", message: "主视觉方案不存在" } },
      { status: 404 }
    );
  }
  await updateJob(jobId, (item) => ({
    ...item,
    selectedVisualOptionId: parsed.data.optionId,
    currentStep: "已选择主视觉方案，等待确认",
    error: undefined
  }));
  return NextResponse.json({ jobId, selectedVisualOptionId: parsed.data.optionId });
}
