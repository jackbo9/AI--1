import crypto from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  campaignBriefFromLegacyInput,
  createJobSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import { createJob, findByKey } from "@/server/job-store";
import { runJob } from "@/worker/run-job";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
import { preflightEmployeeActivity, PosterRenderError } from "@/templates/employee-activity";
import { readJsonRequest } from "@/server/request-json";
import {
  QrAssetError,
  readOwnedQrAssetDataUri
} from "@/server/qr-asset-store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();

  const body = await readJsonRequest(request);
  if (!body.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: body.message } },
      { status: 400 }
    );
  }
  const parsed = createJobSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "提交信息有误"
        }
      },
      { status: 400 }
    );
  }

  const existing = await findByKey(parsed.data.idempotencyKey);
  if (existing) {
    return existing.userId === identity.userId
      ? NextResponse.json(
          { jobId: existing.id, status: existing.status, reused: true },
          { status: 202 }
        )
      : NextResponse.json(
          {
            error: {
              code: "IDEMPOTENCY_CONFLICT",
              message: "幂等键已被占用"
            }
          },
          { status: 409 }
        );
  }

  const campaignBrief = campaignBriefFromLegacyInput(parsed.data.input);
  try {
    const qrDataUri = parsed.data.input.qrAssetId
      ? await readOwnedQrAssetDataUri(
          parsed.data.input.qrAssetId,
          identity.userId
        )
      : undefined;
    await preflightEmployeeActivity(
      posterDocumentSchema.parse({
        schemaVersion: "1.7",
        scene: "employee_activity",
        locale: "zh-CN",
        outputFormat: parsed.data.input.outputFormat,
        category: parsed.data.input.category,
        title: parsed.data.input.activityName,
        subtitle: "",
        summary: parsed.data.input.description,
        sessions: parsed.data.input.sessions,
        audience: parsed.data.input.audience,
        highlights: parsed.data.input.highlights,
        participationSteps: parsed.data.input.participationSteps,
        notice: parsed.data.input.notice,
        includeQr: parsed.data.input.includeQr,
        ctaLabel: parsed.data.input.ctaLabel,
        qrPayload: parsed.data.input.qrPayload,
        qrAssetId: parsed.data.input.qrAssetId,
        contact: parsed.data.input.contact,
        deadline: parsed.data.input.deadline,
        rules: parsed.data.input.rules,
        prize: parsed.data.input.prize,
        immutableSource: {
          outputFormat: true,
          sessions: true,
          audience: true,
          contact: true,
          includeQr: true,
          ctaLabel: true,
          qrPayload: true,
          qrAssetId: true,
          notice: true
        }
      }),
      { qrDataUri }
    );
  } catch (error) {
    if (error instanceof QrAssetError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "QR_ASSET_FORBIDDEN" ? 403 : 422 }
      );
    }
    if (error instanceof PosterRenderError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "T01_CAPACITY_EXCEEDED",
            message: "活动主题超过 T01 模板容量，请返回填写步骤后精简"
          }
        },
        { status: 422 }
      );
    }
    throw error;
  }

  const now = new Date().toISOString();
  const candidate = {
    id: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    idempotencyKey: parsed.data.idempotencyKey,
    actionIdempotencyKeys: [],
    userId: identity.userId,
    campaignBrief,
    input: parsed.data.input,
    status: "QUEUED" as const,
    currentStep: "已进入文案生成队列",
    retryCount: 0,
    artifacts: [],
    versions: [],
    createdAt: now,
    updatedAt: now
  };
  const job = await createJob(candidate);
  if (job.id !== candidate.id) {
    return job.userId === identity.userId
      ? NextResponse.json(
          { jobId: job.id, status: job.status, reused: true },
          { status: 202 }
        )
      : NextResponse.json(
          {
            error: {
              code: "IDEMPOTENCY_CONFLICT",
              message: "幂等键已被占用"
            }
          },
          { status: 409 }
        );
  }

  void runJob(job.id);
  return NextResponse.json(
    { jobId: job.id, status: job.status },
    { status: 202 }
  );
}
