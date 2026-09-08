import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { posterDocumentSchema } from "@/contracts/poster";
import { renderTargetIdSchema } from "@/contracts/brand";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
import { readOwnedQrAssetDataUri } from "@/server/qr-asset-store";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";
import { employeeActivityPosterMarkup } from "@/templates/employee-activity";
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
  const document = parsed.data;
  const format = renderTargetIdSchema.safeParse(body?.format).success
    ? renderTargetIdSchema.parse(body?.format)
    : "portrait_1080x1920";
  const fallback = `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), "public/brand/employee-activity-fallback.svg"))).toString("base64")}`;
  const qr = !document.includeQr ? "" : document.qrAssetId
    ? await readOwnedQrAssetDataUri(document.qrAssetId, identity.userId)
    : document.qrPayload ? await QRCode.toDataURL(document.qrPayload, { width: 144, margin: 0, errorCorrectionLevel: "M" }) : "";
  const brand = await loadEmbeddedBrandAssets();
  if (format === "portrait_1080x1920") {
    return NextResponse.json({ html: employeeActivityPosterMarkup(document, fallback, qr, brand) });
  }
  const assets = { companyLogo: brand.companyLogo, administrationLogo: brand.administrationMark, image: fallback, qr: qr || undefined };
  const content = t01ContentFromDocument(document);
  const markup = format === "longform_1080xAuto"
    ? longformMarkup(content, assets)
    : wideMarkup(format, content, assets);
  return NextResponse.json({ html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${brand.fontFaceCss}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:MiSans,sans-serif}${markup.css}</style></head><body>${markup.html}</body></html>` });
}
