import type { GenerationJob } from "@/contracts/job";

const interruptedStatuses = new Set<GenerationJob["status"]>([
  "QUEUED",
  "VALIDATING_INPUT",
  "GENERATING_COPY",
  "REFINING_VISUAL",
  "GENERATING_ASSET",
  "RENDERING",
  "VALIDATING_OUTPUT"
]);

export function isInterruptedStatus(status: GenerationJob["status"]) {
  return interruptedStatuses.has(status);
}

export function recoverInterruptedJob(
  job: GenerationJob,
  recoveredAt: string
): GenerationJob {
  if (!isInterruptedStatus(job.status)) return job;

  const canReturnToVisualReview = Boolean(
    job.visualDraft &&
      job.confirmedDocument &&
      [
        "REFINING_VISUAL",
        "GENERATING_ASSET",
        "RENDERING",
        "VALIDATING_OUTPUT"
      ].includes(job.status)
  );

  if (canReturnToVisualReview) {
    return {
      ...job,
      status: "READY_FOR_VISUAL_REVIEW",
      visualBatches: job.visualBatches?.map(b => ({ ...b, directions: b.directions.map(d => d.status === "PENDING" || d.status === "GENERATING" ? { ...d, status: "FAILED", error: "服务重启中断，请重试该方案" } : d) })),
      currentStep: "服务重启中断了未完成操作，请从主视觉步骤重试",
      updatedAt: recoveredAt,
      error: {
        code: "JOB_INTERRUPTED_BY_RESTART",
        message: "服务重启时该操作尚未完成，已保留文案和视觉描述，请重新提交。"
      }
    };
  }

  return {
    ...job,
    status: "FAILED_FINAL",
    currentStep: "服务重启中断了未完成任务，请重新提交",
    updatedAt: recoveredAt,
    error: {
      code: "JOB_INTERRUPTED_BY_RESTART",
      message: "服务重启时该任务尚未完成，请返回首页重新提交。"
    }
  };
}

export function recoverInterruptedJobs(
  jobs: GenerationJob[],
  recoveredAt: string
) {
  let recovered = 0;
  const nextJobs = jobs.map((job) => {
    if (!isInterruptedStatus(job.status)) return job;
    recovered += 1;
    return recoverInterruptedJob(job, recoveredAt);
  });
  return { jobs: nextJobs, recovered };
}
