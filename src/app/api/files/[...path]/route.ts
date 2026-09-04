import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { findJob } from "@/server/job-store";
import {
  forbiddenResponse,
  requireApiIdentity,
  unauthorizedResponse
} from "@/server/auth";

export async function GET(
  _: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const identity = await requireApiIdentity();
  if (!identity) return unauthorizedResponse();
  const filename = (await context.params).path.join("/");
  if (!/^[a-zA-Z0-9-]+\.png$/.test(filename)) {
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
      artifact.validation.passed &&
      artifact.outputPath &&
      path.basename(artifact.outputPath) === filename
  );
  const belongsToLegacyVersion = job.versions.some(
    (version) =>
      version.validation.passed &&
      path.basename(version.outputPath) === filename
  );
  if (!belongsToArtifact && !belongsToLegacyVersion) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    return new NextResponse(
      await readFile(path.join(process.cwd(), "data", "generated", filename)),
      {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": "inline; filename=\"" + filename + "\"",
          "Cache-Control": "private, no-store"
        }
      }
    );
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
