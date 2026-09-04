import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiIdentity, forbiddenResponse, unauthorizedResponse } from "@/server/auth";
import { findJob } from "@/server/job-store";
import { claimFormat, formatOutputs, renderClaimedFormat } from "@/server/t01-format-service";
import { extraFormats, ExtraRenderError } from "@/templates/t01-extra-renderer";
import { readJsonRequest } from "@/server/request-json";

export const runtime = "nodejs";
const requestSchema = z.object({ format: z.enum(extraFormats) });
type Context = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, context: Context) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const job = await findJob((await context.params).jobId);
  if (!job) return NextResponse.json({ error: { message: "任务不存在" } }, { status: 404 });
  if (job.userId !== identity.userId) return forbiddenResponse();
  return NextResponse.json({ outputs: formatOutputs(job), currentVisualFamilyId: job.visualMaster?.visualFamilyId ?? job.versions.at(-1)?.id });
}

export async function POST(request: Request, context: Context) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const body = await readJsonRequest(request);
  if (!body.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_FORMAT", message: body.message } },
      { status: 400 }
    );
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_FORMAT", message: "请选择支持的模板尺寸" } }, { status: 400 });
  const { jobId } = await context.params;
  const job = await findJob(jobId);
  if (!job) return NextResponse.json({ error: { message: "任务不存在" } }, { status: 404 });
  if (job.userId !== identity.userId) return forbiddenResponse();
  try {
    const result = await claimFormat(jobId, identity.userId, parsed.data.format);
    if (result.claimed) after(() => renderClaimedFormat(jobId, result.artifact.id, parsed.data.format, result.sourceDocument));
    return NextResponse.json({ artifactId: result.artifact.id, reused: !result.claimed }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: { code: error instanceof ExtraRenderError ? error.code : "FORMAT_REQUEST_FAILED", message: error instanceof ExtraRenderError ? error.message : "暂时无法生成该尺寸，请重试" } }, { status: 409 });
  }
}
