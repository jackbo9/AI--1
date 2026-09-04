import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  campaignBriefFromLegacyInput,
  createJobSchema
} from "@/contracts/poster";
import { createJob, findByKey } from "@/server/job-store";
import { runJob } from "@/worker/run-job";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
export const runtime = "nodejs";
export async function POST(request: Request) { const identity = await requireApiIdentity(); if (!identity) return unauthorizedResponse(); const parsed = createJobSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "提交信息有误" } }, { status: 400 }); const existing = await findByKey(parsed.data.idempotencyKey); if (existing) return existing.userId === identity.userId ? NextResponse.json({ jobId: existing.id, status: existing.status, reused: true }, { status: 202 }) : NextResponse.json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "幂等键已被占用" } }, { status: 409 }); const now = new Date().toISOString(); const campaignBrief = campaignBriefFromLegacyInput(parsed.data.input); const job = await createJob({ id: crypto.randomUUID(), traceId: crypto.randomUUID(), idempotencyKey: parsed.data.idempotencyKey, actionIdempotencyKeys: [], userId: identity.userId, campaignBrief, input: parsed.data.input, status: "QUEUED", currentStep: "已进入文案生成队列", retryCount: 0, artifacts: [], versions: [], createdAt: now, updatedAt: now }); void runJob(job.id); return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 }); }
