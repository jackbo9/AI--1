import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerationJob } from "../src/contracts/job";
import { recoverInterruptedJobs } from "../src/server/job-recovery";

const dataDirectory = path.join(process.cwd(), "data");
const jobsFile = path.join(dataDirectory, "jobs.json");

async function main() {
  let jobs: GenerationJob[];
  try {
    const parsed = JSON.parse(await readFile(jobsFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("data/jobs.json 不是任务数组");
    jobs = parsed as GenerationJob[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("未找到 data/jobs.json，无需恢复任务。");
      return;
    }
    throw error;
  }

  const recoveredAt = new Date().toISOString();
  const result = recoverInterruptedJobs(jobs, recoveredAt);
  if (!result.recovered) {
    console.log("未发现因重启遗留的处理中任务。");
    return;
  }

  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${jobsFile}.${process.pid}.recovery.tmp`;
  try {
    await writeFile(temporaryFile, JSON.stringify(result.jobs, null, 2));
    await rename(temporaryFile, jobsFile);
  } finally {
    await unlink(temporaryFile).catch(() => undefined);
  }
  console.log(`已恢复 ${result.recovered} 个因服务重启遗留的任务。`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
