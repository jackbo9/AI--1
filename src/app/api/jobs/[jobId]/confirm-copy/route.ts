import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  confirmCopySchema,
  confirmedCampaignDocumentFromPoster,
  legacyPortraitInputFromCampaignBrief,
  posterDocumentSchema
} from "@/contracts/poster";
import { findJob, updateJob } from "@/server/job-store";
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
  const parsed = confirmCopySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_COPY",
          message: parsed.error.issues[0]?.message ?? "文案内容有误"
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
  if (job.status !== "READY_FOR_COPY_REVIEW" || !job.copyDraft) {
    return NextResponse.json(
      {
        error: {
          code: "COPY_NOT_READY",
          message: "当前任务尚不能确认文案"
        }
      },
      { status: 409 }
    );
  }

  const input = legacyPortraitInputFromCampaignBrief(job.campaignBrief);
  const document = posterDocumentSchema.parse({
    ...job.copyDraft.document,
    ...parsed.data.content,
    outputFormat: input.outputFormat,
    sessions: input.sessions,
    audience: input.audience,
    notice: input.notice,
    includeQr: input.includeQr,
    ctaLabel: input.ctaLabel,
    qrPayload: input.qrPayload,
    contact: input.contact,
    deadline: input.deadline,
    rules: input.rules,
    prize: input.prize
  });
  const confirmedDocument = confirmedCampaignDocumentFromPoster(
    document,
    crypto.randomUUID()
  );

  await updateJob(jobId, (item) => ({
    ...item,
    actionIdempotencyKeys: [
      ...(item.actionIdempotencyKeys ?? []),
      parsed.data.idempotencyKey
    ],
    status: "READY_FOR_VISUAL_INPUT",
    currentStep: "等待输入主视觉想法",
    copyDraft: { ...item.copyDraft!, document },
    confirmedDocument,
    error: undefined
  }));
  return NextResponse.json(
    { jobId, status: "READY_FOR_VISUAL_INPUT" },
    { status: 202 }
  );
}
