import { NextResponse } from "next/server";
import { requireApiIdentity, unauthorizedResponse, forbiddenResponse } from "@/server/auth";
import { findJob } from "@/server/job-store";

async function disabled(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const job = await findJob((await context.params).jobId);
  if (!job) return NextResponse.json({ error: { code: "JOB_NOT_FOUND", message: "未找到该任务" } }, { status: 404 });
  if (job.userId !== identity.userId) return forbiddenResponse();
  return NextResponse.json({ error: { code: "MASTER_ADAPTATION_DISABLED", message: "已改为同一母图自动裁切排版，请刷新页面后重新选择主视觉。" } }, { status: 410 });
}

export const GET = disabled;
export const POST = disabled;
