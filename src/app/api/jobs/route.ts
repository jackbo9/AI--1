import crypto from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  campaignBriefFromLegacyInput,
  confirmedCampaignDocumentFromPoster,
  createJobSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import { createJob, findByKey } from "@/server/job-store";
import { runCopyStage } from "@/worker/run-job";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
import { preflightEmployeeActivity, PosterRenderError } from "@/templates/employee-activity";
import { readJsonRequest } from "@/server/request-json";
import {
  QrAssetError,
  readOwnedQrAssetDataUri
} from "@/server/qr-asset-store";
import { createT01BaseVisualDraft } from "@/providers/t01-base-visual";
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

  const campaignBrief = campaignBriefFromLegacyInput(parsed.data.input, parsed.data.renderTargets);
  if (
    parsed.data.skipCopy &&
    (!parsed.data.input.slogan.trim() || !parsed.data.input.subtitle.trim())
  ) {
    return NextResponse.json(
      {
        error: {
          code: "COPY_FIELDS_REQUIRED",
          message: "请填写宣言标题和副标题，或先使用 AI 辅助生成后明确应用。"
        }
      },
      { status: 422 }
    );
  }
  try {
    const qrDataUri = parsed.data.input.qrAssetId
      ? await readOwnedQrAssetDataUri(
          parsed.data.input.qrAssetId,
          identity.userId
        )
      : undefined;
    const manualDocument = posterDocumentSchema.parse({
        schemaVersion: "1.7",
        scene: "employee_activity",
        locale: "zh-CN",
        outputFormat: parsed.data.input.outputFormat,
        category: parsed.data.input.category,
        title: parsed.data.input.activityName,
        slogan: parsed.data.input.slogan,
        subtitle: parsed.data.input.subtitle,
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
      });
    // Manual copy is final at this point and must satisfy the template before
    // the job is created. In the AI-copy path slogan/subtitle are intentionally
    // still empty; the generated draft is checked when the user confirms it.
    if (parsed.data.skipCopy) {
      await preflightEmployeeActivity(manualDocument, { qrDataUri });
    }

    const now = new Date().toISOString();
    const baseVisualDraft = parsed.data.skipCopy
      ? createT01BaseVisualDraft(manualDocument, now, now)
      : undefined;
    const candidate = {
      id: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
      idempotencyKey: parsed.data.idempotencyKey,
      actionIdempotencyKeys: [],
      userId: identity.userId,
      campaignBrief,
      input: parsed.data.input,
      status: parsed.data.skipCopy ? "READY_FOR_VISUAL_REVIEW" as const : "QUEUED" as const,
      currentStep: parsed.data.skipCopy ? "基础视觉描述已准备，等待确认" : "已进入文案生成队列",
      retryCount: 0,
      copyDraft: parsed.data.skipCopy ? {
        document: manualDocument,
        provider: "manual-input",
        model: "none",
        promptVersion: "manual-copy-v1",
        createdAt: now
      } : undefined,
      confirmedDocument: parsed.data.skipCopy
        ? confirmedCampaignDocumentFromPoster(manualDocument, crypto.randomUUID())
        : undefined,
      visualInput: baseVisualDraft
        ? {
            originalIntent: baseVisualDraft.description,
            sourceCopyCreatedAt: now,
            createdAt: now
          }
        : undefined,
      visualDraft: baseVisualDraft,
      visualOptions: [],
      artifacts: [],
      versions: [],
      createdAt: now,
      updatedAt: now
    };
    const job = await createJob(candidate);
    if (job.id !== candidate.id) {
      return job.userId === identity.userId
        ? NextResponse.json({ jobId: job.id, status: job.status, reused: true }, { status: 202 })
        : NextResponse.json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "幂等键已被占用" } }, { status: 409 });
    }
    if (!parsed.data.skipCopy) void runCopyStage(job.id);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
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

}
