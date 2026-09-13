import { describe, expect, it } from "vitest";
import { summarizeOwnedJobs } from "@/server/job-history";
import type { StoredJob } from "@/server/job-store";

function tea(id: string, updatedAt: string, previousJobId?: string, status = "READY_FOR_VISUAL_REVIEW") {
  return { scene: "employee-afternoon-tea", id, previousJobId, userId: "owner", idempotencyKey: id, actionIdempotencyKeys: [], sourceVersionId: id, fields: { brief: "水果", food: "无花果", title: id, subtitle: "清甜好时光", visualPrompt: "无花果静物摄影" }, options: [], outputs: [], status, createdAt: updatedAt, updatedAt } as StoredJob;
}

describe("job history summaries", () => {
  it("groups version chains and sorts works by the latest update", () => {
    const result = summarizeOwnedJobs([tea("v1", "2026-09-10T00:00:00.000Z"), tea("v2", "2026-09-11T00:00:00.000Z", "v1"), tea("other", "2026-09-12T00:00:00.000Z")]);
    expect(result.map(item => item.latestJobId)).toEqual(["other", "v2"]);
    expect(result[1]).toMatchObject({ workId: "v1", versionCount: 2, scene: "employee-afternoon-tea" });
  });

  it("keeps orphaned and cyclic records visible without looping", () => {
    const result = summarizeOwnedJobs([tea("orphan", "2026-09-10T00:00:00.000Z", "missing"), tea("a", "2026-09-11T00:00:00.000Z", "b"), tea("b", "2026-09-12T00:00:00.000Z", "a")]);
    expect(result).toHaveLength(2);
    expect(result.find(item => item.latestJobId === "b")?.versionCount).toBe(2);
  });

  it("maps completed and failed states to their resume stages", () => {
    expect(summarizeOwnedJobs([tea("done", "2026-09-10T00:00:00.000Z", undefined, "READY_FOR_REVIEW")])[0]).toMatchObject({ status: "completed", resumeStage: 3 });
  });
});
