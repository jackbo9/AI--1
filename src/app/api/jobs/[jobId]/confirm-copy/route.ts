import crypto from "node:crypto";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import {
  confirmCopySchema,
  confirmedCampaignDocumentFromPoster,
  employeeActivityInputSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import { preflightEmployeeActivity, PosterRenderError } from "@/templates/employee-activity";
import { claimJobAction, findJob, JobActionError } from "@/server/job-store";
import {
  forbiddenResponse,
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";
import { readJsonRequest } from "@/server/request-json";
import {
  QrAssetError,
  readOwnedQrAssetDataUri
} from "@/server/qr-asset-store";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    return await confirmCopy(request, context);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: { code: "INVALID_COPY", message: "文案内容超出允许范围，请检查补充说明和活动规则后重试" } }, { status: 422 });
    }
    console.error("confirm-copy failed", { type: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: { code: "COPY_CONFIRM_FAILED", message: "文案确认暂未完成，已保留输入，请重试" } }, { status: 500 });
  }
}

async function confirmCopy(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const body = await readJsonRequest(request);
  if (!body.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_COPY", message: body.message } },
      { status: 400 }
    );
  }
  const parsed = confirmCopySchema.safeParse(body.value);
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

  const input = employeeActivityInputSchema.parse(job.input);
  if (parsed.data.content.title !== input.activityName) {
    return NextResponse.json(
      { error: { code: "IMMUTABLE_FIELD_CHANGED", message: "活动主题属于锁定事实，不能在确认文案时改写" } },
      { status: 409 }
    );
  }
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
    qrAssetId: input.qrAssetId,
    contact: input.contact,
    deadline: input.deadline,
    rules: parsed.data.content.rules,
    prize: parsed.data.content.prize,
    // The editable supplement is the actual top explanation in T01. Keep
    // summary as a compatibility alias for older preview/read paths.
    subtitle: parsed.data.content.summary,
    summary: parsed.data.content.summary
  });
  const confirmedDocument = confirmedCampaignDocumentFromPoster(
    document,
    crypto.randomUUID()
  );
  try {
    const qrDataUri = input.qrAssetId
      ? await readOwnedQrAssetDataUri(input.qrAssetId, identity.userId)
      : undefined;
    await preflightEmployeeActivity(document, { qrDataUri });
  } catch (error) {
    if (error instanceof QrAssetError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "QR_ASSET_FORBIDDEN" ? 403 : 422 }
      );
    }
    if (error instanceof PosterRenderError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 422 });
    }
    throw error;
  }

  try {
    await claimJobAction(jobId, parsed.data.idempotencyKey, ["READY_FOR_COPY_REVIEW"], (item) => ({
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
  } catch (error) {
    if (error instanceof JobActionError) {
      return NextResponse.json({ error: { code: "COPY_NOT_READY", message: "当前文案已处理，请刷新任务后继续" } }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json(
    { jobId, status: "READY_FOR_VISUAL_INPUT" },
    { status: 202 }
  );
}
