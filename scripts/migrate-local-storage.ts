import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isTeaJob, teaFieldsSchema, type TeaJob } from "../src/contracts/tea";
import type { CampaignGenerationJob } from "../src/contracts/job";

type Job = CampaignGenerationJob | TeaJob;
const apply = process.argv.includes("--apply");
const source = process.argv.find((arg) => arg.startsWith("--source="))?.slice(9) ?? path.join(process.cwd(), "data/jobs.json");
const excluded = /(?:canvas-probe|canvas-review|master-review|tea-test)/;

function referenced(job: Job) {
  if (isTeaJob(job)) return [
    ...job.options.flatMap((item) => item.id === job.selectedVisualOptionId ? [item.assetPath, item.previewPath] : []),
    ...job.outputs.filter((item) => item.exportAllowed).map((item) => item.outputPath)
  ].filter((value): value is string => Boolean(value));
  return [
    ...(job.visualOptions ?? []).filter((item) => item.id === job.selectedVisualOptionId).map((item) => item.assetPath),
    ...(job.artifacts ?? []).filter((item) => item.status === "READY" && (item.validation.exportAllowed ?? item.validation.passed)).flatMap((item) => [item.assetPath, item.outputPath]),
    ...job.versions.filter((item) => item.validation.exportAllowed ?? item.validation.passed).flatMap((item) => [item.assetPath, item.outputPath])
  ].filter((value): value is string => Boolean(value));
}

function migrationView(job: Job): Job {
  if (isTeaJob(job)) return { ...job, fields: teaFieldsSchema.parse(job.fields), options: job.options.filter((item) => item.id === job.selectedVisualOptionId), outputs: job.outputs.filter((item) => item.exportAllowed) };
  return { ...job, visualOptions: (job.visualOptions ?? []).filter((item) => item.id === job.selectedVisualOptionId), artifacts: (job.artifacts ?? []).filter((item) => item.status === "READY" && (item.validation.exportAllowed ?? item.validation.passed)), versions: job.versions.filter((item) => item.validation.exportAllowed ?? item.validation.passed) };
}

async function main() {
  const parsed = JSON.parse(await readFile(source, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("迁移源不是任务数组");
  const jobs = parsed.filter((item): item is Job => Boolean(item && typeof item === "object" && "id" in item && "userId" in item)).map(migrationView);
  const files = [...new Set(jobs.flatMap(referenced))];
  const missing: string[] = [], skipped: string[] = []; let bytes = 0;
  for (const file of files) {
    if (excluded.test(path.basename(file))) { skipped.push(file); continue; }
    try { bytes += (await stat(file)).size; } catch { missing.push(file); }
  }
  const report = { mode: apply ? "apply" : "dry-run", users: new Set(jobs.map((job) => job.userId)).size, jobs: jobs.length, files: files.length - skipped.length - missing.length, bytes, skipped: skipped.length, missing };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) return;
  if (!process.env.DATABASE_URL || process.env.STORAGE_DRIVER !== "oss") throw new Error("正式迁移需要 DATABASE_URL 和 STORAGE_DRIVER=oss");
  const { saveJob } = await import("../src/server/postgres-job-repository");
  for (const job of jobs) await saveJob(job);
  for (const file of files.filter((item) => !excluded.test(path.basename(item)))) await access(file).catch(() => undefined);
  console.log(JSON.stringify({ migratedJobs: jobs.length, migratedFiles: report.files }));
}

main().then(() => process.exit(0), (error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
