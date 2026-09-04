import { beforeEach, describe, expect, it, vi } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import type { CampaignGenerationJob, GenerationVersion } from "@/contracts/job";
import { campaignBriefFromLegacyInput, employeeActivityInputSchema, posterDocumentSchema } from "@/contracts/poster";
import { findJob, updateJob } from "@/server/job-store";
import { claimFormat, renderClaimedFormat } from "@/server/t01-format-service";
import { ExtraRenderError, renderT01Extra } from "@/templates/t01-extra-renderer";

vi.mock("@/server/job-store", () => ({ findJob: vi.fn(), updateJob: vi.fn() }));
vi.mock("@/lib/env", () => ({ serverEnv: { READABILITY_MODE: "trial" } }));
vi.mock("@/templates/t01-extra-renderer", () => ({
  extraTemplateVersion: "test-template-v1",
  renderT01Extra: vi.fn(),
  ExtraRenderError: class extends Error {
    constructor(readonly code: string, message: string) { super(message); }
  }
}));

const input = employeeActivityInputSchema.parse(normal);
const document = posterDocumentSchema.parse({
  ...input, schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN",
  title: "秋日同行", subtitle: "相聚草坪", summary: "本次活动说明",
  immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true }
});
const now = "2026-09-04T00:00:00.000Z";
const version: GenerationVersion = {
  id: "original-version", createdAt: now, posterDocument: document,
  outputFormat: "portrait_1080x1920", templateVersion: "portrait-v1",
  promptVersion: "copy-v1", illustrationPromptVersion: "visual-v1",
  modelInfo: { copyProvider: "fixture", copyModel: "fixture", compilerProvider: "fixture", imageProvider: "fixture", imageModel: "fixture" },
  assetMode: "generated", assetPath: "/fixture/source.png", outputPath: "/fixture/portrait.png",
  validation: { passed: true, exportAllowed: true, messages: [] }
};

let stored: CampaignGenerationJob;

beforeEach(() => {
  vi.resetAllMocks();
  stored = structuredClone({
    id: "job", traceId: "trace", idempotencyKey: "create", actionIdempotencyKeys: [], userId: "owner",
    input, campaignBrief: campaignBriefFromLegacyInput(input), status: "READY_FOR_REVIEW",
    currentStep: "完成", retryCount: 0, artifacts: [], versions: [version], createdAt: now, updatedAt: now
  });
  // Model the store's serialized, detached read/update contract, without disk IO.
  // These tests check service behavior under that contract, not the store lock.
  let mutations: Promise<unknown> = Promise.resolve();
  vi.mocked(updateJob).mockImplementation((id, change) => {
    const mutation = mutations.then(() => {
      if (id !== stored.id) throw new Error("Unknown job");
      stored = structuredClone(change(structuredClone(stored))) as CampaignGenerationJob;
      return structuredClone(stored);
    });
    mutations = mutation.catch(() => undefined);
    return mutation;
  });
  vi.mocked(findJob).mockImplementation(async id => id === stored.id ? structuredClone(stored) : undefined);
  vi.mocked(renderT01Extra).mockResolvedValue({
    outputPath: "/fixture/landscape.png", width: 1920, height: 1080, templateVersion: "test-template-v1",
    checks: { fontAndLogos: true, capacity: true, outputSize: true }, contrast: undefined
  });
});

describe("T01 format claims and isolated completion", () => {
  it("reuses one rendering artifact for concurrent repeated requests", async () => {
    const claims = await Promise.all(Array.from({ length: 8 }, () => claimFormat("job", "owner", "landscape_1920x1080")));
    expect(claims.filter(result => result.claimed)).toHaveLength(1);
    expect(new Set(claims.map(result => result.artifact.id)).size).toBe(1);
    expect(stored.artifacts).toHaveLength(1);
    expect(renderT01Extra).not.toHaveBeenCalled();
  });

  it("creates a retry artifact after failure and keeps the failed attempt", async () => {
    const first = await claimFormat("job", "owner", "landscape_1920x1080");
    vi.mocked(renderT01Extra).mockRejectedValueOnce(new ExtraRenderError("CONTENT_CAPACITY", "内容超出容量"));
    await renderClaimedFormat("job", first.artifact.id, "landscape_1920x1080", first.sourceDocument);
    const retry = await claimFormat("job", "owner", "landscape_1920x1080");
    expect(retry.claimed).toBe(true);
    expect(retry.artifact.id).not.toBe(first.artifact.id);
    expect(stored.artifacts).toHaveLength(2);
    expect(stored.artifacts[0]).toMatchObject({ status: "FAILED", error: { code: "CONTENT_CAPACITY" } });
    expect(stored.artifacts[1].status).toBe("RENDERING");
  });

  it("renders the claimed document and asset even after a newer version is saved", async () => {
    const old = await claimFormat("job", "owner", "landscape_1920x1080");
    stored.versions.push({ ...structuredClone(version), id: "new-version", assetPath: "/fixture/new.png", posterDocument: { ...structuredClone(document), title: "更新后的活动" } });
    const next = await claimFormat("job", "owner", "landscape_1920x1080");
    await renderClaimedFormat("job", old.artifact.id, "landscape_1920x1080", old.sourceDocument);
    expect(next.claimed).toBe(true);
    expect(next.artifact.documentVersionId).toBe("new-version");
    expect(old.sourceDocument.title).toBe("秋日同行");
    expect(renderT01Extra).toHaveBeenCalledWith("landscape_1920x1080", old.sourceDocument, "/fixture/source.png", `job-${old.artifact.id}`, { readabilityMode: "trial" });
    expect(stored.artifacts.find(item => item.id === next.artifact.id)?.status).toBe("RENDERING");
  });

  it("merges completion into current artifacts without overwriting another completed format", async () => {
    const landscape = await claimFormat("job", "owner", "landscape_1920x1080");
    const banner = await claimFormat("job", "owner", "banner_2227x950");
    const other = { ...banner.artifact, status: "READY" as const, outputPath: "/fixture/banner.png", validation: { passed: true, messages: ["独立完成"] } };
    vi.mocked(renderT01Extra).mockImplementationOnce(async () => {
      stored.artifacts = stored.artifacts.map(item => item.id === banner.artifact.id ? structuredClone(other) : item);
      return { outputPath: "/fixture/landscape.png", width: 1920, height: 1080, templateVersion: "test-template-v1", checks: { fontAndLogos: true, capacity: true, outputSize: true }, contrast: undefined };
    });
    await renderClaimedFormat("job", landscape.artifact.id, "landscape_1920x1080", landscape.sourceDocument);
    expect(stored.artifacts.find(item => item.id === banner.artifact.id)).toEqual(other);
    expect(stored.artifacts.find(item => item.id === landscape.artifact.id)?.status).toBe("READY");
  });

  it("isolates a rendering failure from another format and the original version", async () => {
    const landscape = await claimFormat("job", "owner", "landscape_1920x1080");
    const banner = await claimFormat("job", "owner", "banner_2227x950");
    const versions = structuredClone(stored.versions);
    vi.mocked(renderT01Extra).mockRejectedValueOnce(new Error("private renderer details"));
    await renderClaimedFormat("job", landscape.artifact.id, "landscape_1920x1080", landscape.sourceDocument);
    expect(stored.artifacts.find(item => item.id === banner.artifact.id)).toEqual(banner.artifact);
    expect(stored.versions).toEqual(versions);
    expect(stored.artifacts.find(item => item.id === landscape.artifact.id)).toMatchObject({ status: "FAILED", error: { code: "FORMAT_RENDER_FAILED", message: "该尺寸暂未生成成功，请重试" } });
  });
});
