import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerationJob } from "@/contracts/job";

const dataDir = path.join(process.cwd(), "data");
const jobFile = path.join(dataDir, "jobs.json");
async function readJobs(): Promise<GenerationJob[]> { try { return JSON.parse(await readFile(jobFile, "utf8")) as GenerationJob[]; } catch { return []; } }
async function saveJobs(jobs: GenerationJob[]) { await mkdir(dataDir, { recursive: true }); await writeFile(jobFile, JSON.stringify(jobs, null, 2)); }
export async function findJob(id: string) { return (await readJobs()).find((job) => job.id === id); }
export async function findByKey(key: string) { return (await readJobs()).find((job) => job.idempotencyKey === key); }
export async function createJob(job: GenerationJob) { const jobs = await readJobs(); jobs.unshift(job); await saveJobs(jobs); return job; }
export async function updateJob(id: string, change: (job: GenerationJob) => GenerationJob) { const jobs = await readJobs(); const index = jobs.findIndex((job) => job.id === id); if (index < 0) throw new Error("任务不存在"); jobs[index] = { ...change(jobs[index]), updatedAt: new Date().toISOString() }; await saveJobs(jobs); return jobs[index]; }
