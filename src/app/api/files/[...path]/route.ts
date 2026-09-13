import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { findJob } from "@/server/job-store";
import {
  forbiddenResponse,
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const filename = (await context.params).path.join("/");
  if (!/^[a-zA-Z0-9-]+\.(?:png|jpg|webp|svg)$/.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const jobId = filename.match(/^([0-9a-f-]{36})(?:-|\.png)/i)?.[1];
  if (!jobId) return new NextResponse("Not found", { status: 404 });
  const job = await findJob(jobId);
  if (!job) return new NextResponse("Not found", { status: 404 });
  if (job.userId !== identity.userId) return forbiddenResponse();
  const belongsToArtifact = job.artifacts.some(
    (artifact) =>
      artifact.status === "READY" &&
      (artifact.validation.exportAllowed ?? artifact.validation.passed) &&
      artifact.outputPath &&
      path.basename(artifact.outputPath) === filename
  );
  const belongsToLegacyVersion = job.versions.some(
    (version) =>
      (version.validation.exportAllowed ?? version.validation.passed) &&
      path.basename(version.outputPath) === filename
  );
  const belongsToVisualOption = (job.visualOptions ?? []).some(
    (option) => path.basename(option.assetPath) === filename
  );
  if (!belongsToArtifact && !belongsToLegacyVersion && !belongsToVisualOption) {
    return new NextResponse("Not found", { status: 404 });
  }
  const format = new URL(request.url).searchParams.get("format");
  if (format && format !== "jpg") return NextResponse.json({ error: { code: "INVALID_DOWNLOAD_FORMAT", message: "不支持的下载格式" } }, { status: 400 });
  if (format === "jpg" && (!(belongsToArtifact || belongsToLegacyVersion) || !filename.endsWith(".png"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(process.cwd(), "data", "generated", filename));
    if (format === "jpg") {
      try {
        const jpeg = await sharp(bytes).flatten({ background: "#ffffff" }).jpeg({ quality: 95 }).toBuffer();
        return new NextResponse(new Uint8Array(jpeg), { headers: {
          "Content-Type": "image/jpeg",
          "Content-Disposition": 'attachment; filename="' + filename.replace(/\.png$/, ".jpg") + '"',
          "Cache-Control": "private, no-store"
        } });
      } catch {
        return NextResponse.json({ error: { code: "JPG_CONVERSION_FAILED", message: "JPG 转换失败，请重试或下载 PNG" } }, { status: 500 });
      }
    }
    return new NextResponse(
      bytes,
      {
        headers: {
          "Content-Type": contentTypeFor(filename),
          "Content-Disposition": "inline; filename=\"" + filename + "\"",
          "Cache-Control": "private, no-store"
        }
      }
    );
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

function contentTypeFor(filename: string) {
  if (filename.endsWith(".jpg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}
