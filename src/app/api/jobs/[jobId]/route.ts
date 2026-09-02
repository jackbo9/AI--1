import { NextResponse } from "next/server";
import { findJob } from "@/server/job-store";
export const runtime = "nodejs";
export async function GET(_: Request, context: { params: Promise<{ jobId: string }> }) { const job = await findJob((await context.params).jobId); if (!job) return NextResponse.json({ error: { code: "JOB_NOT_FOUND", message: "未找到该任务" } }, { status: 404 }); const version = job.versions.at(-1); return NextResponse.json({ ...job, previewUrl: version ? `/api/files/${job.id}.png` : undefined }); }
