import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { posterDocumentSchema } from "@/contracts/poster";
import { renderTargetIdSchema } from "@/contracts/brand";
import {
  forbiddenResponse,
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";
import { findJob, updateJob } from "@/server/job-store";
import { readOwnedQrAssetDataUri } from "@/server/qr-asset-store";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";
import {
  analyzeEmployeeActivityVisual,
  employeeActivityPosterMarkup
} from "@/templates/employee-activity";
import type { T01ReadabilityReport } from "@/templates/t01-readability";
import { wideMarkup } from "@/templates/t01-wide";
import { longformMarkup } from "@/templates/t01-longform";
import { t01ContentFromDocument } from "@/templates/t01-template-content";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const body = await request.json().catch(() => undefined);
  const parsed = posterDocumentSchema.safeParse(body?.document);
  if (!parsed.success) return NextResponse.json({ error: "预览数据无效" }, { status: 400 });
  let document = parsed.data;
  const format = renderTargetIdSchema.safeParse(body?.format).success
    ? renderTargetIdSchema.parse(body?.format)
    : "portrait_1080x1920";
  const fallback = `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), "public/brand/employee-activity-fallback.svg"))).toString("base64")}`;
  let previewImage = fallback;
  let previewReadability: T01ReadabilityReport | undefined;
  let selectedJobId: string | undefined;
  let selectedOptionId: string | undefined;
  let selectedAssetPath: string | undefined;
  if (
    typeof body?.jobId === "string" &&
    typeof body?.visualOptionId === "string"
  ) {
    const job = await findJob(body.jobId);
    if (!job) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (job.userId !== identity.userId) return forbiddenResponse();
    const option = (job.visualOptions ?? []).find(
      (candidate) => candidate.id === body.visualOptionId
    );
    if (!option) {
      return NextResponse.json({ error: "主视觉方案不存在" }, { status: 404 });
    }
    previewImage = await visualOptionDataUri(option.assetPath);
    document = option.sourceDocument;
    previewReadability = option.readability;
    selectedJobId = job.id;
    selectedOptionId = option.id;
    selectedAssetPath = option.assetPath;
  }
  const qr = !document.includeQr ? "" : document.qrAssetId
    ? await readOwnedQrAssetDataUri(document.qrAssetId, identity.userId)
    : document.qrPayload ? await QRCode.toDataURL(document.qrPayload, { width: 144, margin: 0, errorCorrectionLevel: "M" }) : "";
  if (
    selectedJobId &&
    selectedOptionId &&
    selectedAssetPath &&
    !previewReadability
  ) {
    previewReadability = await analyzeEmployeeActivityVisual(
      document,
      selectedAssetPath,
      { qrDataUri: document.qrAssetId ? qr : undefined }
    );
    const readability = previewReadability;
    await updateJob(selectedJobId, (job) => ({
      ...job,
      visualOptions: (job.visualOptions ?? []).map((option) =>
        option.id === selectedOptionId ? { ...option, readability } : option
      )
    }));
  }
  const brand = await loadEmbeddedBrandAssets();
  if (format === "portrait_1080x1920") {
    return NextResponse.json({
      html: employeeActivityPosterMarkup(
        document,
        previewImage,
        qr,
        brand,
        previewReadability
      )
    });
  }
  const assets = { companyLogo: brand.companyLogo, administrationLogo: brand.administrationMark, image: previewImage, qr: qr || undefined };
  const content = t01ContentFromDocument(document);
  const markup = format === "longform_1080xAuto"
    ? longformMarkup(content, assets)
    : wideMarkup(format, content, assets);
  return NextResponse.json({ html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${brand.fontFaceCss}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:MiSans,sans-serif}${markup.css}</style></head><body>${markup.html}</body></html>` });
}

async function visualOptionDataUri(assetPath: string) {
  const generatedRoot = path.resolve(process.cwd(), "data", "generated");
  const resolved = path.resolve(assetPath);
  if (!resolved.startsWith(`${generatedRoot}${path.sep}`)) {
    throw new Error("主视觉方案路径无效");
  }
  const extension = path.extname(resolved).toLowerCase();
  const mime =
    extension === ".jpg" || extension === ".jpeg"
      ? "image/jpeg"
      : extension === ".webp"
        ? "image/webp"
        : extension === ".svg"
          ? "image/svg+xml"
          : "image/png";
  return `data:${mime};base64,${(await readFile(resolved)).toString("base64")}`;
}
