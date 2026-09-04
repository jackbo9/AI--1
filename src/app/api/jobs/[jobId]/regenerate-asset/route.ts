import { NextResponse } from "next/server";
import { regenerateAssetSchema } from "@/contracts/poster";
import { findJob, updateJob } from "@/server/job-store";
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
  const parsed = regenerateAssetSchema.safeParse(await request.json());
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

  await updateJob(jobId, (item) => ({
    ...item,
    actionIdempotencyKeys: [
      ...(item.actionIdempotencyKeys ?? []),
      parsed.data.idempotencyKey
    ],
    status: "GENERATING_ASSET",
    currentStep: "仅重新生成主视觉",
    error: undefined
  }));
  void runVisualStage(jobId, latestVersion.posterDocument);

  return NextResponse.json(
    { jobId, status: "GENERATING_ASSET" },
    { status: 202 }
  );
}
