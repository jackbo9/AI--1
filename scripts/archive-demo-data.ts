import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

type StoredJob = {
  id?: unknown;
  status?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
};

const dataDirectory = path.join(process.cwd(), "data");
const jobsFile = path.join(dataDirectory, "jobs.json");
const generatedDirectory = path.join(dataDirectory, "generated");
const transientStatuses = new Set([
  "QUEUED",
  "VALIDATING_INPUT",
  "GENERATING_COPY",
  "REFINING_VISUAL",
  "GENERATING_ASSET",
  "RENDERING",
  "VALIDATING_OUTPUT"
]);

function readCutoff() {
  const value = process.argv.find((argument) => argument.startsWith("--before="))?.slice(9);
  if (!value) throw new Error("请传入 --before=<ISO 时间>，例如 --before=2026-09-10T00:00:00+08:00");
  const cutoff = new Date(value);
  if (!Number.isFinite(cutoff.getTime())) throw new Error(`无效的归档时间：${value}`);
  return cutoff;
}

function isHistorical(job: StoredJob, cutoff: Date) {
  if (typeof job.updatedAt !== "string" || typeof job.status !== "string") return false;
  if (transientStatuses.has(job.status)) return false;
  const updatedAt = new Date(job.updatedAt);
  return Number.isFinite(updatedAt.getTime()) && updatedAt < cutoff;
}

function collectGeneratedFilenames(value: unknown, result = new Set<string>()) {
  if (typeof value === "string") {
    if (value.includes(`${path.sep}data${path.sep}generated${path.sep}`)) {
      result.add(path.basename(value));
    }
    return result;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectGeneratedFilenames(item, result);
    return result;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectGeneratedFilenames(item, result);
  }
  return result;
}

async function main() {
  const cutoff = readCutoff();
  const parsed = JSON.parse(await readFile(jobsFile, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("data/jobs.json 不是任务数组");
  const jobs = parsed as StoredJob[];
  const archivedJobs = jobs.filter((job) => isHistorical(job, cutoff));
  const keptJobs = jobs.filter((job) => !isHistorical(job, cutoff));

  const archiveId = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDirectory = path.join(dataDirectory, "archive", archiveId);
  const archiveGeneratedDirectory = path.join(archiveDirectory, "generated");
  await mkdir(archiveGeneratedDirectory, { recursive: true });
  await writeFile(
    path.join(archiveDirectory, "jobs.json"),
    JSON.stringify(archivedJobs, null, 2)
  );

  const keptFiles = collectGeneratedFilenames(keptJobs);
  const archivedIds = new Set(
    archivedJobs.flatMap((job) => (typeof job.id === "string" ? [job.id] : []))
  );
  let archivedFiles = 0;
  let archivedBytes = 0;
  for (const entry of await readdir(generatedDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === ".gitkeep" || keptFiles.has(entry.name)) continue;
    const source = path.join(generatedDirectory, entry.name);
    const metadata = await stat(source);
    const belongsToArchivedJob = [...archivedIds].some((id) => entry.name.startsWith(id));
    if (!belongsToArchivedJob && metadata.mtime >= cutoff) continue;
    await rename(source, path.join(archiveGeneratedDirectory, entry.name));
    archivedFiles += 1;
    archivedBytes += metadata.size;
  }

  const temporaryJobsFile = `${jobsFile}.${process.pid}.archive.tmp`;
  await writeFile(temporaryJobsFile, JSON.stringify(keptJobs, null, 2));
  await rename(temporaryJobsFile, jobsFile);
  await writeFile(
    path.join(archiveDirectory, "manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        cutoff: cutoff.toISOString(),
        archivedJobs: archivedJobs.length,
        keptJobs: keptJobs.length,
        archivedFiles,
        archivedBytes
      },
      null,
      2
    )
  );

  console.log(`归档目录：${archiveDirectory}`);
  console.log(`任务：归档 ${archivedJobs.length}，保留 ${keptJobs.length}`);
  console.log(`产物：归档 ${archivedFiles} 个，${(archivedBytes / 1024 / 1024).toFixed(1)} MiB`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
