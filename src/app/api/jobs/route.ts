import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createJobSchema } from "@/contracts/poster";
import { createJob, findByKey } from "@/server/job-store";
import { runJob } from "@/worker/run-job";
export const runtime = "nodejs";
export async function POST(request: Request) { const parsed = createJobSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "提交信息有误" } }, { status: 400 }); const existing = await findByKey(parsed.data.idempotencyKey); if (existing) return NextResponse.json({ jobId: existing.id, status: existing.status, reused: true }, { status: 202 }); const now = new Date().toISOString(); const job = await createJob({ id: crypto.randomUUID(), traceId: crypto.randomUUID(), idempotencyKey: parsed.data.idempotencyKey, userId: "local-demo-user", input: parsed.data.input, status: "QUEUED", currentStep: "已进入生成队列", retryCount: 0, versions: [], createdAt: now, updatedAt: now }); void runJob(job.id); return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 }); }
