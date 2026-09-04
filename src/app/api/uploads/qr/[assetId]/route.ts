import { NextResponse } from "next/server";
import {
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";
import {
  QrAssetError,
  readOwnedQrAsset
} from "@/server/qr-asset-store";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  try {
    const { assetId } = await context.params;
    const { asset, bytes } = await readOwnedQrAsset(assetId, identity.userId);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Disposition": `inline; filename="${asset.filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof QrAssetError) {
      return new NextResponse("Not found", {
        status: error.code === "QR_ASSET_FORBIDDEN" ? 403 : 404
      });
    }
    return new NextResponse("Not found", { status: 404 });
  }
}
