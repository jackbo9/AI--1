import { describe, expect, it } from "vitest";
import { QrAssetError, inspectQrImage } from "@/server/qr-asset-store";

function pngHeader(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpegHeader(width: number, height: number) {
  const bytes = Buffer.alloc(21);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xc0;
  bytes.writeUInt16BE(17, 4);
  bytes[6] = 8;
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return bytes;
}

describe("QR image upload storage validation", () => {
  it("uses magic bytes rather than a client MIME type", () => {
    expect(inspectQrImage(pngHeader(256, 256))).toMatchObject({
      mimeType: "image/png",
      extension: "png",
      width: 256,
      height: 256
    });
    expect(inspectQrImage(jpegHeader(160, 200))).toMatchObject({
      mimeType: "image/jpeg",
      extension: "jpg",
      width: 160,
      height: 200
    });
  });

  it("rejects non-images and QR images below the minimum raster size", () => {
    expect(() => inspectQrImage(Buffer.from("not an image"))).toThrow(
      QrAssetError
    );
    expect(() => inspectQrImage(pngHeader(95, 96))).toThrow(
      "二维码图片尺寸需在 96–8192 像素之间"
    );
  });
});
