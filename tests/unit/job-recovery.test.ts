import { describe, expect, it } from "vitest";
import type { GenerationJob } from "@/contracts/job";
import { recoverInterruptedJob } from "@/server/job-recovery";

const recoveredAt = "2026-09-10T06:00:00.000Z";

function job(status: GenerationJob["status"]): GenerationJob {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    traceId: "22222222-2222-4222-8222-222222222222",
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
    actionIdempotencyKeys: [],
    userId: "demo-user",
    input: {} as GenerationJob["input"],
    status,
    currentStep: "working",
    retryCount: 0,
    artifacts: [],
    versions: [],
    createdAt: recoveredAt,
    updatedAt: recoveredAt
  };
}

describe("recoverInterruptedJob", () => {
  it("returns interrupted asset generation to visual review when its inputs survive", () => {
    const input = {
      ...job("GENERATING_ASSET"),
      visualDraft: {} as NonNullable<GenerationJob["visualDraft"]>,
      confirmedDocument: {} as NonNullable<GenerationJob["confirmedDocument"]>
    };
    const result = recoverInterruptedJob(input, recoveredAt);
    expect(result.status).toBe("READY_FOR_VISUAL_REVIEW");
    expect(result.error?.code).toBe("JOB_INTERRUPTED_BY_RESTART");
  });

  it("marks interrupted copy generation as failed instead of leaving endless polling", () => {
    const result = recoverInterruptedJob(job("GENERATING_COPY"), recoveredAt);
    expect(result.status).toBe("FAILED_FINAL");
    expect(result.error?.code).toBe("JOB_INTERRUPTED_BY_RESTART");
  });

  it("does not change completed jobs", () => {
    const input = job("READY_FOR_REVIEW");
    expect(recoverInterruptedJob(input, recoveredAt)).toBe(input);
  });
});
