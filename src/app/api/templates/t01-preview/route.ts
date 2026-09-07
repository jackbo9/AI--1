import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { posterDocumentSchema } from "@/contracts/poster";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
import { readOwnedQrAssetDataUri } from "@/server/qr-asset-store";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";
import { employeeActivityPosterMarkup } from "@/templates/employee-activity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const body = await request.json().catch(() => undefined);
  const parsed = posterDocumentSchema.safeParse(body?.document);
  if (!parsed.success) return NextResponse.json({ error: "预览数据无效" }, { status: 400 });
  const document = parsed.data;
  const fallback = `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), "public/brand/employee-activity-fallback.svg"))).toString("base64")}`;
  const qr = !document.includeQr ? "" : document.qrAssetId
    ? await readOwnedQrAssetDataUri(document.qrAssetId, identity.userId)
    : document.qrPayload ? await QRCode.toDataURL(document.qrPayload, { width: 144, margin: 0, errorCorrectionLevel: "M" }) : "";
  return NextResponse.json({ html: employeeActivityPosterMarkup(document, fallback, qr, await loadEmbeddedBrandAssets()) });
}
