import { NextResponse } from "next/server";
import path from "node:path";
import { findJob } from "@/server/job-store";
import {
  forbiddenResponse,
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";
export const runtime = "nodejs";
export async function GET(_: Request, context: { params: Promise<{ jobId: string }> }) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const job = await findJob((await context.params).jobId);
  if (!job) return NextResponse.json({ error: { code: "JOB_NOT_FOUND", message: "未找到该任务" } }, { status: 404 });
  if (job.userId !== identity.userId) return forbiddenResponse();
  const artifact = [...job.artifacts].reverse().find(item => item.renderTargetId === "portrait_1080x1920" && item.status === "READY" && item.outputPath);
  const outputPath = job.versions.at(-1)?.outputPath ?? artifact?.outputPath;
  return NextResponse.json({ ...job, actionIdempotencyKeys: undefined, previewUrl: outputPath ? `/api/files/${path.basename(outputPath)}` : undefined });
}
