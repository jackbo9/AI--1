import crypto from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { isTeaJob } from "@/contracts/tea";
import type { PersistedJob } from "./postgres-job-repository";
import { objectStorage } from "@/providers/object-storage";
import { prisma } from "./prisma";
import { serverEnv } from "@/lib/env";

type Candidate = { id: string; kind: "visual" | "output"; filePath: string; width?: number; height?: number; templateVersion?: string; validation?: unknown; provider?: string; model?: string; selected?: boolean };
const exists = (filePath: string) => access(filePath).then(() => true, () => false);
const mime = (filePath: string) => filePath.endsWith(".jpg") ? "image/jpeg" : filePath.endsWith(".webp") ? "image/webp" : filePath.endsWith(".svg") ? "image/svg+xml" : "image/png";
const userHash = (userId: string) => crypto.createHash("sha256").update(userId).digest("hex").slice(0, 24);
const stableId = (jobId: string, kind: string, filePath: string) => crypto.createHash("sha256").update(`${jobId}:${kind}:${filePath}`).digest("hex");

function candidates(job: PersistedJob): Candidate[] {
  if (isTeaJob(job)) return [
    ...job.options.flatMap((item) => [item.assetPath && { id: item.id, kind: "visual" as const, filePath: item.assetPath, provider: item.provider, model: item.model, selected: item.id === job.selectedVisualOptionId }, item.previewPath && { id: `${item.id}-preview`, kind: "visual" as const, filePath: item.previewPath, selected: item.id === job.selectedVisualOptionId }].filter(Boolean) as Candidate[]),
    ...job.outputs.flatMap((item) => item.outputPath ? [{ id: item.id, kind: "output" as const, filePath: item.outputPath, width: item.width, height: item.height, templateVersion: item.templateVersion, validation: { passed: item.passed, exportAllowed: item.exportAllowed, messages: item.messages, contrast: item.contrast } }] : [])
  ];
  return [
    ...(job.visualOptions ?? []).map((item) => ({ id: item.id, kind: "visual" as const, filePath: item.assetPath, provider: item.imageProvider, model: item.imageModel, selected: item.id === job.selectedVisualOptionId })),
    ...(job.artifacts ?? []).flatMap((item) => [item.assetPath && { id: `${item.id}-visual`, kind: "visual" as const, filePath: item.assetPath, width: item.width, height: item.height, selected: item.id === job.confirmedVisualOptionId }, item.outputPath && { id: item.id, kind: "output" as const, filePath: item.outputPath, width: item.width, height: item.height, templateVersion: item.templateVersion, validation: item.validation }].filter(Boolean) as Candidate[])
  ];
}

export async function syncJobAssets(job: PersistedJob) {
  if (!serverEnv.DATABASE_URL || serverEnv.STORAGE_DRIVER !== "oss") return;
  await prisma.visualAsset.updateMany({ where: { jobId: job.id }, data: { selected: false, expiresAt: new Date(Date.now() + 30 * 86400000) } });
  const unique = new Map(candidates(job).map((item) => [`${item.kind}:${item.filePath}`, item]));
  for (const item of unique.values()) {
    if (!(await exists(item.filePath))) continue;
    const filename = path.basename(item.filePath);
    const objectKey = `users/${userHash(job.userId)}/jobs/${job.id}/${item.kind}/${filename}`;
    const id = stableId(job.id, item.kind, item.filePath);
    const present = item.kind === "visual" ? await prisma.visualAsset.findUnique({ where: { objectKey } }) : await prisma.posterOutput.findUnique({ where: { objectKey } });
    if (item.kind === "output" && present) continue;
    if (item.kind === "visual" && present && "status" in present && present.status === "READY") {
      await prisma.visualAsset.update({ where: { id: present.id }, data: { selected: item.selected ?? false, expiresAt: item.selected ? null : new Date(Date.now() + 30 * 86400000) } });
      continue;
    }
    try {
      await prisma.storageCleanup.upsert({ where: { objectKey }, create: { objectKey, reason: "upload-not-yet-linked" }, update: {} });
      await objectStorage().putFile({ objectKey, filePath: item.filePath, contentType: mime(item.filePath) });
      if (item.kind === "visual") await prisma.visualAsset.upsert({ where: { id }, create: { id, jobId: job.id, ownerId: job.userId, kind: filename.includes("preview") ? "preview" : "visual", objectKey, contentType: mime(item.filePath), width: item.width, height: item.height, provider: item.provider, model: item.model, status: "READY", selected: item.selected ?? false, expiresAt: item.selected ? null : new Date(Date.now() + 30 * 86400000) }, update: { status: "READY", selected: item.selected ?? false, expiresAt: item.selected ? null : new Date(Date.now() + 30 * 86400000) } });
      else await prisma.posterOutput.create({ data: { id, jobId: job.id, ownerId: job.userId, objectKey, contentType: mime(item.filePath), width: item.width ?? 1080, height: item.height ?? 1920, templateVersion: item.templateVersion ?? "legacy", validation: JSON.parse(JSON.stringify(item.validation ?? {})) } });
      await prisma.storageCleanup.delete({ where: { objectKey } });
      await objectStorage().deleteLocalFile(item.filePath);
    } catch (error) {
      if (item.kind === "visual") await prisma.visualAsset.upsert({ where: { id }, create: { id, jobId: job.id, ownerId: job.userId, kind: "visual", objectKey, contentType: mime(item.filePath), status: "FAILED", selected: item.selected ?? false, expiresAt: new Date(Date.now() + 30 * 86400000) }, update: { status: "FAILED" } });
      throw error;
    }
  }
}

export async function readOwnedStoredFile(ownerId: string, jobId: string, filename: string) {
  if (!serverEnv.DATABASE_URL || serverEnv.STORAGE_DRIVER !== "oss") return undefined;
  const suffix = `/${filename}`;
  const output = await prisma.posterOutput.findFirst({ where: { ownerId, jobId, objectKey: { endsWith: suffix }, job: { deletedAt: null } } });
  const visual = output ? undefined : await prisma.visualAsset.findFirst({ where: { ownerId, jobId, objectKey: { endsWith: suffix }, status: "READY", job: { deletedAt: null } } });
  const record = output ?? visual;
  return record ? { bytes: await objectStorage().getBuffer(record.objectKey), contentType: record.contentType, isOutput: Boolean(output) } : undefined;
}

export async function readGeneratedAsset(filePath: string) {
  const { readFile } = await import("node:fs/promises");
  try { return await readFile(filePath); }
  catch {
    if (!serverEnv.DATABASE_URL || serverEnv.STORAGE_DRIVER !== "oss") throw new Error("FILE_NOT_FOUND");
    const suffix = `/${path.basename(filePath)}`;
    const visual = await prisma.visualAsset.findFirst({ where: { objectKey: { endsWith: suffix }, status: "READY", job: { deletedAt: null } } });
    if (!visual) throw new Error("FILE_NOT_FOUND");
    return objectStorage().getBuffer(visual.objectKey);
  }
}
