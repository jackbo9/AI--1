import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import { isTeaJob, teaFieldsSchema, type TeaJob } from "@/contracts/tea";
import path from "node:path";
import type {
  Artifact,
  CampaignGenerationJob,
  GenerationJob,
  GenerationVersion
} from "@/contracts/job";
import type {
  CampaignBrief,
  EmployeeActivityInput
} from "@/contracts/poster";
import {
  campaignBriefFromLegacyInput,
  employeeActivityInputSchema
} from "@/contracts/poster";
import { activityTemplateFamilyManifest } from "@/templates/activity-template-family";

const dataDir = path.join(process.cwd(), "data");
const jobFile = path.join(dataDir, "jobs.json");
let mutationQueue: Promise<void> = Promise.resolve();

type StoredGenerationJob = Omit<
  GenerationJob,
  "input" | "campaignBrief" | "artifacts" | "visualOptions"
> & {
  input: unknown;
  campaignBrief?: CampaignBrief;
  artifacts?: Artifact[];
  visualOptions?: GenerationJob["visualOptions"];
};

async function readAllJobs(): Promise<Array<CampaignGenerationJob | TeaJob>> {
  try {
    const parsed = JSON.parse(await readFile(jobFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("任务存储格式无效，已停止写入以保护历史数据");
    return parsed.flatMap<CampaignGenerationJob | TeaJob>((item) => {
      if (isTeaJob(item)) return [{ ...item, fields: teaFieldsSchema.parse(item.fields) }];
      try {
        return [normalizeStoredJob(item as StoredGenerationJob)];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readJobs(): Promise<CampaignGenerationJob[]> {
  return (await readAllJobs()).filter((job): job is CampaignGenerationJob => !isTeaJob(job));
}

async function saveJobs(jobs: GenerationJob[]) {
  await saveAllJobs([...jobs, ...(await readAllJobs()).filter(isTeaJob)]);
}

async function saveAllJobs(jobs: Array<GenerationJob | TeaJob>) {
  await mkdir(dataDir, { recursive: true });
  const temporaryFile = `${jobFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, JSON.stringify(jobs, null, 2));
    await rename(temporaryFile, jobFile);
  } finally {
    await unlink(temporaryFile).catch(() => undefined);
  }
}

export async function findTeaJob(id: string) {
  return (await readAllJobs()).filter(isTeaJob).find(job => job.id === id);
}

export async function createTeaJob(job: TeaJob) {
  return withMutation(async () => {
    const jobs = await readAllJobs();
    const existing = jobs.find(item => item.idempotencyKey === job.idempotencyKey);
    if (existing) {
      if (!isTeaJob(existing) || existing.userId !== job.userId) throw new Error("幂等键已被占用");
      return existing;
    }
    jobs.unshift(job);
    await saveAllJobs(jobs);
    return job;
  });
}

export async function updateTeaJob(id: string, change: (job: TeaJob) => TeaJob) {
  return withMutation(async () => {
    const jobs = await readAllJobs();
    const index = jobs.findIndex(job => job.id === id);
    const current = jobs[index];
    if (!isTeaJob(current)) throw new Error("下午茶任务不存在");
    const next = { ...change(current), updatedAt: new Date().toISOString() };
    jobs[index] = next;
    await saveAllJobs(jobs);
    return next;
  });
}

function withMutation<T>(operation: () => Promise<T>) {
  const next = mutationQueue.then(operation, operation);
  mutationQueue = next.then(() => undefined, () => undefined);
  return next;
}

export function normalizeStoredJob(
  job: StoredGenerationJob
): CampaignGenerationJob {
  const input = normalizeLegacyInput(job.input, job.versions);
  const campaignBrief =
    job.campaignBrief ??
    campaignBriefFromLegacyInput(input);

  return {
    ...job,
    input,
    campaignBrief,
    visualOptions: job.visualOptions ?? [],
    artifacts:
      job.artifacts ??
      job.versions.map((version) => artifactFromLegacyVersion(version))
  };
}

function normalizeLegacyInput(
  input: unknown,
  versions: GenerationVersion[]
): EmployeeActivityInput {
  const current = employeeActivityInputSchema.safeParse(input);
  if (current.success) return current.data;

  if (!input || typeof input !== "object") {
    throw new Error("旧任务输入格式无效");
  }
  const source = input as Record<string, unknown>;
  // `audience` became a required fact in PosterDocument 1.7. Only historical
  // stored jobs receive the migration default; new API input must provide it.
  const migratedSource =
    typeof source.audience === "string" && source.audience.trim()
      ? source
      : { ...source, audience: "全体员工" };

  const phaseOnePointFive = employeeActivityInputSchema.safeParse({
    ...migratedSource,
    outputFormat: "portrait_1080x1920",
    includeQr: Boolean(source.qrPayload || source.qrAssetId)
  });
  if (phaseOnePointFive.success) return phaseOnePointFive.data;

  const latestDocument = versions.at(-1)?.posterDocument as unknown as
    | Record<string, unknown>
    | undefined;
  const legacyHighlights = Array.isArray(latestDocument?.highlights)
    ? latestDocument.highlights.slice(0, 4)
    : ["活动体验", "同事互动"];
  const description =
    typeof source.description === "string"
      ? source.description
      : "历史员工活动任务";

  return employeeActivityInputSchema.parse({
    outputFormat: "portrait_1080x1920",
    activityName:
      typeof source.activityName === "string"
        ? source.activityName
        : "历史员工活动",
    category: "team",
    audience: "全体员工",
    themeKeywords: [],
    description,
    sessions: [
      {
        label: "活动场次",
        date:
          typeof source.date === "string" ? source.date : "2026-01-01",
        time: typeof source.time === "string" ? source.time : "待通知",
        location:
          typeof source.location === "string" ? source.location : "待通知",
        details: []
      }
    ],
    highlights:
      legacyHighlights.length >= 2
        ? legacyHighlights
        : ["活动体验", "同事互动"],
    participationSteps: ["按活动通知参与"],
    notice: "具体安排以现场通知为准。",
    includeQr: false,
    ctaLabel: "",
    qrPayload: "",
    qrAssetId: "",
    contact: "",
    visualIntent: description.slice(0, 180)
  });
}

function artifactFromLegacyVersion(version: GenerationVersion): Artifact {
  const target =
    activityTemplateFamilyManifest.renderTargets.portrait_1080x1920;
  const dimensions = target.dimensions;
  if (dimensions.heightMode !== "fixed") {
    throw new Error("旧版竖版尺寸配置无效");
  }

  return {
    id: version.id,
    renderTargetId: "portrait_1080x1920",
    status: "READY",
    createdAt: version.createdAt,
    brandSpecVersion: 1,
    documentVersionId: version.id,
    visualFamilyId: version.id,
    width: dimensions.width,
    heightMode: "fixed",
    height: dimensions.height,
    templateId: target.templateId,
    templateVersion: version.templateVersion,
    assetMode: version.assetMode,
    assetDetail: version.assetDetail,
    assetPath: version.assetPath,
    outputPath: version.outputPath,
    validation: version.validation
  };
}

export async function findJob(id: string) {
  return (await readJobs()).find((job) => job.id === id);
}

export async function findByKey(key: string) {
  return (await readJobs()).find((job) => job.idempotencyKey === key);
}

export async function createJob(job: GenerationJob) {
  return withMutation(async () => {
    const jobs = await readJobs();
    const existing = jobs.find((item) => item.idempotencyKey === job.idempotencyKey);
    if (existing) return existing;
    const normalized = normalizeStoredJob(job);
    jobs.unshift(normalized);
    await saveJobs(jobs);
    return normalized;
  });
}

export async function updateJob(
  id: string,
  change: (job: CampaignGenerationJob) => GenerationJob
) {
  return withMutation(async () => {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.id === id);
    if (index < 0) throw new Error("任务不存在");
    jobs[index] = normalizeStoredJob({
      ...change(jobs[index]),
      updatedAt: new Date().toISOString()
    });
    await saveJobs(jobs);
    return jobs[index];
  });
}

export class JobActionError extends Error {
  constructor(
    readonly code: "ACTION_REUSED" | "ACTION_NOT_ALLOWED" | "STALE_ACTION",
    message: string
  ) {
    super(message);
    this.name = "JobActionError";
  }
}

/** Claim an action and mutate its job in one serialized read-modify-write. */
export async function claimJobAction(
  id: string,
  idempotencyKey: string,
  allowedStatuses: string[],
  change: (job: CampaignGenerationJob) => GenerationJob
) {
  return withMutation(async () => {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.id === id);
    if (index < 0) throw new Error("任务不存在");
    const current = jobs[index];
    if (current.actionIdempotencyKeys?.includes(idempotencyKey)) {
      throw new JobActionError("ACTION_REUSED", "该操作已提交");
    }
    if (!allowedStatuses.includes(current.status)) {
      throw new JobActionError("ACTION_NOT_ALLOWED", "当前任务状态不允许执行该操作");
    }
    jobs[index] = normalizeStoredJob({
      ...change(current),
      updatedAt: new Date().toISOString()
    });
    await saveJobs(jobs);
    return jobs[index];
  });
}
