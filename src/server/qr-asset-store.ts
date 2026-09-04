import crypto from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const qrAssetDirectory = path.join(process.cwd(), "data", "uploads", "qr");
const metadataFile = path.join(qrAssetDirectory, "assets.json");
const maximumFileBytes = 5 * 1024 * 1024;
const minimumPixels = 96;
const maximumPixels = 8_192;
let mutationQueue: Promise<void> = Promise.resolve();

const qrAssetSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  filename: z.string().min(1).max(180),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  byteSize: z.number().int().positive().max(maximumFileBytes),
  width: z.number().int().min(minimumPixels).max(maximumPixels),
  height: z.number().int().min(minimumPixels).max(maximumPixels),
  storageName: z.string().regex(/^[0-9a-f-]{36}\.(png|jpg|webp)$/i),
  createdAt: z.string().datetime()
});

export type QrAsset = z.infer<typeof qrAssetSchema>;

export class QrAssetError extends Error {
  constructor(
    readonly code:
      | "QR_UPLOAD_INVALID"
      | "QR_UPLOAD_TOO_LARGE"
      | "QR_UPLOAD_TOO_SMALL"
      | "QR_ASSET_NOT_FOUND"
      | "QR_ASSET_FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "QrAssetError";
  }
}

type DetectedImage = {
  mimeType: QrAsset["mimeType"];
  extension: "png" | "jpg" | "webp";
  width: number;
  height: number;
};

export function inspectQrImage(bytes: Buffer): DetectedImage {
  const detected =
    inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes);
  if (!detected) {
    throw new QrAssetError(
      "QR_UPLOAD_INVALID",
      "仅支持 PNG、JPEG 或 WebP 格式的二维码图片"
    );
  }
  if (
    detected.width < minimumPixels ||
    detected.height < minimumPixels ||
    detected.width > maximumPixels ||
    detected.height > maximumPixels
  ) {
    throw new QrAssetError(
      "QR_UPLOAD_TOO_SMALL",
      `二维码图片尺寸需在 ${minimumPixels}–${maximumPixels} 像素之间`
    );
  }
  return detected;
}

export async function storeQrAsset(input: {
  ownerId: string;
  filename: string;
  bytes: Buffer;
}) {
  if (!input.bytes.length) {
    throw new QrAssetError("QR_UPLOAD_INVALID", "二维码图片不能为空");
  }
  if (input.bytes.length > maximumFileBytes) {
    throw new QrAssetError(
      "QR_UPLOAD_TOO_LARGE",
      "二维码图片不能超过 5MB"
    );
  }
  const image = inspectQrImage(input.bytes);
  const id = crypto.randomUUID();
  const asset: QrAsset = {
    id,
    ownerId: input.ownerId,
    filename: normalizedFilename(input.filename),
    mimeType: image.mimeType,
    byteSize: input.bytes.length,
    width: image.width,
    height: image.height,
    storageName: `${id}.${image.extension}`,
    createdAt: new Date().toISOString()
  };

  await withMutation(async () => {
    const assets = await readAssets();
    await mkdir(qrAssetDirectory, { recursive: true });
    const finalPath = path.join(qrAssetDirectory, asset.storageName);
    const temporaryPath = `${finalPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, input.bytes, { flag: "wx" });
      await rename(temporaryPath, finalPath);
      await saveAssets([...assets, asset]);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      await unlink(finalPath).catch(() => undefined);
      throw error;
    }
  });

  return asset;
}

export async function getQrAsset(assetId: string) {
  if (!isAssetId(assetId)) return undefined;
  return (await readAssets()).find((asset) => asset.id === assetId);
}

export async function requireOwnedQrAsset(assetId: string, ownerId: string) {
  const asset = await getQrAsset(assetId);
  if (!asset) {
    throw new QrAssetError("QR_ASSET_NOT_FOUND", "未找到该二维码图片");
  }
  if (asset.ownerId !== ownerId) {
    throw new QrAssetError("QR_ASSET_FORBIDDEN", "你无权使用该二维码图片");
  }
  return asset;
}

export async function readOwnedQrAssetDataUri(assetId: string, ownerId: string) {
  const asset = await requireOwnedQrAsset(assetId, ownerId);
  const bytes = await readFile(path.join(qrAssetDirectory, asset.storageName));
  const detected = inspectQrImage(bytes);
  if (
    detected.mimeType !== asset.mimeType ||
    detected.width !== asset.width ||
    detected.height !== asset.height
  ) {
    throw new QrAssetError("QR_UPLOAD_INVALID", "二维码图片存储校验失败");
  }
  return `data:${asset.mimeType};base64,${bytes.toString("base64")}`;
}

export async function readOwnedQrAsset(assetId: string, ownerId: string) {
  const asset = await requireOwnedQrAsset(assetId, ownerId);
  return { asset, bytes: await readFile(path.join(qrAssetDirectory, asset.storageName)) };
}

function isAssetId(value: string) {
  return z.string().uuid().safeParse(value).success;
}

async function readAssets(): Promise<QrAsset[]> {
  try {
    const parsed = JSON.parse(await readFile(metadataFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const result = qrAssetSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

async function saveAssets(assets: QrAsset[]) {
  await mkdir(qrAssetDirectory, { recursive: true });
  const temporaryFile = `${metadataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, JSON.stringify(assets, null, 2));
    await rename(temporaryFile, metadataFile);
  } finally {
    await unlink(temporaryFile).catch(() => undefined);
  }
}

function withMutation<T>(operation: () => Promise<T>) {
  const next = mutationQueue.then(operation, operation);
  mutationQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function normalizedFilename(value: string) {
  const filename = path.basename(value).replace(/[^\w.\-()\u4e00-\u9fff]/g, "_");
  return (filename || "qr-code").slice(0, 180);
}

function inspectPng(bytes: Buffer): DetectedImage | undefined {
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ) ||
    bytes.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return undefined;
  }
  return {
    mimeType: "image/png",
    extension: "png",
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

function inspectJpeg(bytes: Buffer): DetectedImage | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) return undefined;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return undefined;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (length < 7) return undefined;
      return {
        mimeType: "image/jpeg",
        extension: "jpg",
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  return undefined;
}

function inspectWebp(bytes: Buffer): DetectedImage | undefined {
  if (
    bytes.length < 30 ||
    bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
    bytes.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return undefined;
  }
  const kind = bytes.subarray(12, 16).toString("ascii");
  if (kind === "VP8X" && bytes.length >= 30) {
    return {
      mimeType: "image/webp",
      extension: "webp",
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    };
  }
  if (kind === "VP8 " && bytes.length >= 30) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return undefined;
    }
    return {
      mimeType: "image/webp",
      extension: "webp",
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    };
  }
  if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    return {
      mimeType: "image/webp",
      extension: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  return undefined;
}
