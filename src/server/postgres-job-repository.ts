import { Prisma } from "@prisma/client";
import { isTeaJob, type TeaJob } from "@/contracts/tea";
import type { CampaignGenerationJob } from "@/contracts/job";
import { prisma } from "./prisma";
import { syncJobAssets } from "./job-assets";

export type PersistedJob = CampaignGenerationJob | TeaJob;

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const scene = (job: PersistedJob) => isTeaJob(job) ? job.scene : "employee_activity";
const step = (job: PersistedJob) => isTeaJob(job) ? job.status : job.currentStep;

export async function readActiveJobs() {
  const rows = await prisma.jobPayload.findMany({
    where: { job: { deletedAt: null } },
    include: { job: true },
    orderBy: { job: { updatedAt: "desc" } }
  });
  return rows.map((row) => row.data as unknown as PersistedJob);
}

export async function readActiveJob(id: string) {
  const row = await prisma.jobPayload.findFirst({
    where: { jobId: id, job: { deletedAt: null } }
  });
  return row?.data as unknown as PersistedJob | undefined;
}

export async function readActiveJobByKey(idempotencyKey: string) {
  const row = await prisma.job.findFirst({
    where: { idempotencyKey, deletedAt: null },
    include: { payload: true }
  });
  return row?.payload?.data as unknown as PersistedJob | undefined;
}

export async function updatePersistedJob(id: string, change: (job: PersistedJob) => PersistedJob) {
  let nextJob: PersistedJob | undefined;
  await prisma.$transaction(async (tx) => {
    const row = await tx.jobPayload.findFirst({ where: { jobId: id, job: { deletedAt: null } } });
    if (!row) throw new Error("任务不存在");
    const next = change(row.data as unknown as PersistedJob);
    nextJob = { ...next, updatedAt: new Date().toISOString() } as PersistedJob;
    await tx.job.update({ where: { id }, data: { status: nextJob.status, currentStep: step(nextJob), updatedAt: new Date(nextJob.updatedAt) } });
    await tx.jobPayload.update({ where: { jobId: id }, data: { data: json(nextJob) } });
  });
  await syncJobAssets(nextJob!);
  return nextJob!;
}

export async function claimPersistedJobAction(id: string, idempotencyKey: string, allowedStatuses: string[], change: (job: PersistedJob) => PersistedJob) {
  let nextJob: PersistedJob | undefined;
  await prisma.$transaction(async (tx) => {
    const duplicate = await tx.jobAction.findUnique({ where: { idempotencyKey } });
    if (duplicate) throw new PersistedActionError("ACTION_REUSED", "该操作已提交");
    const row = await tx.jobPayload.findFirst({ where: { jobId: id, job: { deletedAt: null } } });
    if (!row) throw new Error("任务不存在");
    const current = row.data as unknown as PersistedJob;
    if (!allowedStatuses.includes(current.status)) throw new PersistedActionError("ACTION_NOT_ALLOWED", "当前任务状态不允许执行该操作");
    nextJob = { ...change(current), updatedAt: new Date().toISOString() } as PersistedJob;
    await tx.jobAction.create({ data: { jobId: id, idempotencyKey, action: "job-action", status: "COMPLETED" } });
    await tx.job.update({ where: { id }, data: { status: nextJob.status, currentStep: step(nextJob), updatedAt: new Date(nextJob.updatedAt) } });
    await tx.jobPayload.update({ where: { jobId: id }, data: { data: json(nextJob) } });
  });
  await syncJobAssets(nextJob!);
  return nextJob!;
}

export class PersistedActionError extends Error {
  constructor(readonly code: "ACTION_REUSED" | "ACTION_NOT_ALLOWED", message: string) { super(message); }
}

export async function saveJob(job: PersistedJob) {
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: job.userId },
      create: { id: job.userId, displayName: job.userId },
      update: {}
    });
    await tx.job.upsert({
      where: { id: job.id },
      create: {
        id: job.id, userId: job.userId, scene: scene(job), status: job.status,
        currentStep: step(job), previousJobId: job.previousJobId,
        idempotencyKey: job.idempotencyKey, createdAt: new Date(job.createdAt), updatedAt: new Date(job.updatedAt)
      },
      update: {
        status: job.status, currentStep: step(job), previousJobId: job.previousJobId,
        updatedAt: new Date(job.updatedAt)
      }
    });
    await tx.jobPayload.upsert({
      where: { jobId: job.id },
      create: { jobId: job.id, schemaVersion: "1", data: json(job) },
      update: { schemaVersion: "1", data: json(job) }
    });
    for (const key of job.actionIdempotencyKeys ?? []) {
      await tx.jobAction.upsert({ where: { idempotencyKey: key }, create: { jobId: job.id, idempotencyKey: key, action: "job-action", status: "COMPLETED" }, update: { status: "COMPLETED" } });
    }
  });
  await syncJobAssets(job);
  return job;
}

export async function softDeleteWork(jobId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.job.findFirst({ where: { id: jobId, userId, deletedAt: null } });
    if (!source) return false;
    const jobs = await tx.job.findMany({ where: { userId, deletedAt: null }, select: { id: true, previousJobId: true } });
    const parent = new Map(jobs.map((job) => [job.id, job.previousJobId]));
    const rootOf = (id: string) => { const seen = new Set<string>(); let current = id; while (parent.get(current) && !seen.has(current)) { seen.add(current); current = parent.get(current)!; } return current; };
    const root = rootOf(jobId);
    const ids = jobs.filter((job) => rootOf(job.id) === root).map((job) => job.id);
    const now = new Date();
    const purgeAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await tx.job.updateMany({ where: { id: { in: ids }, userId }, data: { deletedAt: now, purgeAfter } });
    return true;
  });
}

export async function purgeDeletedJobs(now = new Date()) {
  const jobs = await prisma.job.findMany({ where: { deletedAt: { not: null }, purgeAfter: { lte: now } }, include: { visualAssets: true, posterOutputs: true } });
  if (!jobs.length) return { jobIds: [], objectKeys: [] };
  const ids = jobs.map((job) => job.id);
  const objectKeys = jobs.flatMap((job) => [...job.visualAssets.map((item) => item.objectKey), ...job.posterOutputs.map((item) => item.objectKey)]);
  await prisma.$transaction(async (tx) => {
    for (const objectKey of objectKeys) await tx.storageCleanup.upsert({ where: { objectKey }, create: { objectKey, reason: "purged-job" }, update: { reason: "purged-job" } });
    await tx.job.deleteMany({ where: { id: { in: ids } } });
  });
  return { jobIds: ids, objectKeys };
}

export async function syncUserIdentity(identity: { userId: string; displayName: string; tenantKey?: string; openId?: string }) {
  await prisma.user.upsert({ where: { id: identity.userId }, create: { id: identity.userId, displayName: identity.displayName, tenantKey: identity.tenantKey, openId: identity.openId }, update: { displayName: identity.displayName, tenantKey: identity.tenantKey, openId: identity.openId } });
}
