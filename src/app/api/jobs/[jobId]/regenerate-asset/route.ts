import { NextResponse } from "next/server";
import { regenerateAssetSchema } from "@/contracts/poster";
import { claimJobAction, findJob, JobActionError } from "@/server/job-store";
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
      { error: { code: "INVALID_REQUEST", message: body.message } },
      { status: 400 }
    );
  }
  const parsed = regenerateAssetSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "重新生成请求无效"
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
  if (job.userId !== identity.userId) return forbiddenResponse();
  if (job.actionIdempotencyKeys?.includes(parsed.data.idempotencyKey)) {
    return NextResponse.json(
      { jobId, status: job.status, reused: true },
      { status: 202 }
    );
  }

  const latestVersion = job.versions.at(-1);
  if (job.status !== "READY_FOR_REVIEW" || !latestVersion) {
    return NextResponse.json(
      {
        error: {
          code: "RESULT_NOT_READY",
          message: "当前任务尚不能重新生成主视觉"
        }
      },
      { status: 409 }
    );
  }

  try {
    await claimJobAction(jobId, parsed.data.idempotencyKey, ["READY_FOR_REVIEW"], (item) => ({
      ...item,
      actionIdempotencyKeys: [
        ...(item.actionIdempotencyKeys ?? []),
        parsed.data.idempotencyKey
      ],
      status: "READY_FOR_VISUAL_INPUT",
      currentStep: "请确认新的主视觉描述",
      visualInput: {
        originalIntent:
          item.confirmedVisual?.description ??
          item.visualInput?.originalIntent ??
          "",
        sourceCopyCreatedAt: item.copyDraft?.createdAt ?? "",
        createdAt: new Date().toISOString()
      },
      visualDraft: undefined,
      confirmedVisual: undefined,
      error: undefined
    }));
  } catch (error) {
    if (error instanceof JobActionError) {
      return NextResponse.json({ error: { code: "RESULT_NOT_READY", message: "当前任务尚不能重新生成主视觉" } }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(
    { jobId, status: "READY_FOR_VISUAL_INPUT" },
    { status: 202 }
  );
}
