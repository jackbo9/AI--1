import { NextResponse } from "next/server";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
import {
  QrAssetError,
  storeQrAsset
} from "@/server/qr-asset-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return uploadError("QR_UPLOAD_INVALID", "请使用 multipart/form-data 上传二维码图片");
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return uploadError("QR_UPLOAD_INVALID", "请选择二维码图片文件");
  }
  try {
    const asset = await storeQrAsset({
      ownerId: identity.userId,
      filename: file.name,
      bytes: Buffer.from(await file.arrayBuffer())
    });
    return NextResponse.json(
      {
        assetId: asset.id,
        filename: asset.filename,
        width: asset.width,
        height: asset.height,
        previewUrl: `/api/uploads/qr/${asset.id}`
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof QrAssetError) {
      const status =
        error.code === "QR_UPLOAD_TOO_LARGE" ? 413 : 400;
      return uploadError(error.code, error.message, status);
    }
    return uploadError("QR_UPLOAD_FAILED", "二维码图片上传失败，请稍后重试", 500);
  }
}

function uploadError(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}
