import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import { campaignBriefFromLegacyInput } from "@/contracts/poster";
import { activityTemplateFamilyManifest } from "@/templates/activity-template-family";

const dataDir = path.join(process.cwd(), "data");
const jobFile = path.join(dataDir, "jobs.json");

type StoredGenerationJob = GenerationJob & {
  campaignBrief?: CampaignBrief;
  artifacts?: Artifact[];
  input: EmployeeActivityInput;
};

async function readJobs(): Promise<CampaignGenerationJob[]> {
  try {
    const parsed = JSON.parse(await readFile(jobFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      try {
        return [normalizeStoredJob(item as StoredGenerationJob)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

async function saveJobs(jobs: GenerationJob[]) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(jobFile, JSON.stringify(jobs, null, 2));
}

export function normalizeStoredJob(
  job: StoredGenerationJob
): CampaignGenerationJob {
  const campaignBrief =
    job.campaignBrief ??
    campaignBriefFromLegacyInput(job.input);

  return {
    ...job,
    campaignBrief,
    artifacts:
      job.artifacts ??
      job.versions.map((version) => artifactFromLegacyVersion(version))
  };
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
  const jobs = await readJobs();
  const normalized = normalizeStoredJob(job);
  jobs.unshift(normalized);
  await saveJobs(jobs);
  return normalized;
}

export async function updateJob(
  id: string,
  change: (job: CampaignGenerationJob) => GenerationJob
) {
  const jobs = await readJobs();
  const index = jobs.findIndex((job) => job.id === id);
  if (index < 0) throw new Error("任务不存在");
  jobs[index] = normalizeStoredJob({
    ...change(jobs[index]),
    updatedAt: new Date().toISOString()
  });
  await saveJobs(jobs);
  return jobs[index];
}
