import { access } from "node:fs/promises";
import path from "node:path";
import { isTeaJob } from "@/contracts/tea";
import type { JobHistoryItem, JobHistoryResponse, HistoryStatus } from "@/contracts/history";
import type { StoredJob } from "./job-store";
import { listOwnedJobs } from "./job-store";
import { latestPortraitPreviewOutputPath } from "./portrait-preview";
import { serverEnv } from "@/lib/env";

const processing = new Set(["QUEUED", "VALIDATING_INPUT", "GENERATING_COPY", "REFINING_VISUAL", "GENERATING_ASSET", "RENDERING", "VALIDATING_OUTPUT"]);

function rootId(job: StoredJob, owned: Map<string, StoredJob>) {
  const pathIds: string[] = [];
  const positions = new Map<string, number>();
  let current = job;
  while (true) {
    const cycleAt = positions.get(current.id);
    if (cycleAt !== undefined) return [...pathIds.slice(cycleAt)].sort()[0] ?? job.id;
    positions.set(current.id, pathIds.length);
    pathIds.push(current.id);
    if (!current.previousJobId) return current.id;
    const previous = owned.get(current.previousJobId);
    if (!previous) return current.id;
    current = previous;
  }
}

function activityStatus(status: string): { status: HistoryStatus; resumeStage: 1 | 2 | 3 } {
  if (status === "READY_FOR_REVIEW") return { status: "completed", resumeStage: 3 };
  if (status === "FAILED_FINAL" || status === "FAILED_RETRYABLE") return { status: "failed", resumeStage: 1 };
  if (processing.has(status)) return { status: "processing", resumeStage: status === "QUEUED" || status === "VALIDATING_INPUT" || status === "GENERATING_COPY" ? 1 : status === "RENDERING" || status === "VALIDATING_OUTPUT" ? 3 : 2 };
  if (status === "READY_FOR_COPY_REVIEW") return { status: "copy_review", resumeStage: 1 };
  return { status: "visual_review", resumeStage: 2 };
}

function teaCover(job: Extract<StoredJob, { scene: "employee-afternoon-tea" }>) {
  return [...job.outputs].reverse().find((output) => output.exportAllowed && output.outputPath)?.outputPath;
}

function title(job: StoredJob) {
  if (isTeaJob(job)) return { title: job.fields.title, subtitle: job.fields.subtitle };
  return {
    title: job.copyDraft?.document.title || job.input.activityName || "未命名体育海报",
    subtitle: job.copyDraft?.document.subtitle || job.input.subtitle || undefined
  };
}

function compareNewest(a: StoredJob, b: StoredJob) {
  return b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id);
}

export function summarizeOwnedJobs(jobs: StoredJob[]) {
  const owned = new Map(jobs.map((job) => [job.id, job]));
  const groups = new Map<string, StoredJob[]>();
  for (const job of jobs) {
    const root = rootId(job, owned);
    groups.set(root, [...(groups.get(root) ?? []), job]);
  }
  return [...groups.entries()].map(([workId, versions]) => {
    const ordered = [...versions].sort(compareNewest);
    const latest = ordered[0];
    const state = isTeaJob(latest)
      ? latest.status === "READY_FOR_REVIEW" ? { status: "completed" as const, resumeStage: 3 as const }
        : processing.has(latest.status) ? { status: "processing" as const, resumeStage: latest.status === "RENDERING" ? 3 as const : 1 as const }
        : { status: "visual_review" as const, resumeStage: 1 as const }
      : activityStatus(latest.status);
    const coverPath = ordered.map((version) => isTeaJob(version) ? teaCover(version) : latestPortraitPreviewOutputPath(version)).find(Boolean);
    return { workId, latestJobId: latest.id, scene: isTeaJob(latest) ? "employee-afternoon-tea" as const : "employee_activity" as const, ...title(latest), ...state, updatedAt: latest.updatedAt, versionCount: versions.length, coverPath };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.latestJobId.localeCompare(a.latestJobId));
}

function encodeCursor(item: { updatedAt: string; latestJobId: string }) {
  return Buffer.from(JSON.stringify([item.updatedAt, item.latestJobId])).toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2 || !parsed.every((value) => typeof value === "string")) throw new HistoryCursorError();
    return parsed as [string, string];
  } catch (error) { if (error instanceof HistoryCursorError) throw error; throw new HistoryCursorError(); }
}

export class HistoryCursorError extends Error {}

export async function listJobHistory(userId: string, limit: number, cursor?: string): Promise<JobHistoryResponse> {
  const summaries = summarizeOwnedJobs(await listOwnedJobs(userId));
  let start = 0;
  if (cursor) {
    const [updatedAt, id] = decodeCursor(cursor);
    start = summaries.findIndex((item) => item.updatedAt < updatedAt || (item.updatedAt === updatedAt && item.latestJobId < id));
    if (start < 0) return { items: [] };
  }
  const page = summaries.slice(start, start + limit);
  const items: JobHistoryItem[] = await Promise.all(page.map(async ({ coverPath, ...item }) => {
    let coverUrl: string | undefined;
    if (coverPath) {
      if (serverEnv.STORAGE_DRIVER === "oss") coverUrl = `/api/files/${path.basename(coverPath)}`;
      else try { await access(coverPath); coverUrl = `/api/files/${path.basename(coverPath)}`; } catch { /* Keep the task visible with a neutral placeholder. */ }
    }
    return { ...item, coverUrl, hasDownloadableOutput: Boolean(coverUrl) };
  }));
  const next = summaries[start + limit];
  return { items, nextCursor: next ? encodeCursor(page.at(-1)!) : undefined };
}
