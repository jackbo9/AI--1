import { describe, expect, it } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import {
  campaignBriefFromLegacyInput,
  campaignBriefSchema,
  confirmedCampaignDocumentFromPoster,
  employeeActivityInputSchema,
  legacyPortraitInputFromCampaignBrief
} from "@/contracts/poster";
import type { GenerationJob } from "@/contracts/job";
import { generateCopy } from "@/providers/copy-provider";
import { normalizeStoredJob } from "@/server/job-store";

describe("Campaign and Bundle migration contract", () => {
  it("upgrades one legacy portrait input to a four-target CampaignBrief", () => {
    const legacyInput = employeeActivityInputSchema.parse(normal);
    const campaign = campaignBriefFromLegacyInput(legacyInput);

    expect(campaignBriefSchema.parse(campaign)).toEqual(campaign);
    expect("outputFormat" in campaign).toBe(false);
    expect(campaign.renderTargets).toEqual([
      "portrait_1080x1920",
      "landscape_1920x1080",
      "banner_2227x950",
      "longform_1080xAuto"
    ]);
    expect(legacyPortraitInputFromCampaignBrief(campaign)).toEqual(legacyInput);
  });

  it("freezes one confirmed document without binding it to a format", async () => {
    const input = employeeActivityInputSchema.parse(normal);
    const { document } = await generateCopy(input);
    const confirmed = confirmedCampaignDocumentFromPoster(
      document,
      "3f2f69ac-69e2-47ab-a227-207ca8767908"
    );

    expect(confirmed.documentVersionId).toBe(
      "3f2f69ac-69e2-47ab-a227-207ca8767908"
    );
    expect("outputFormat" in confirmed).toBe(false);
    expect(confirmed.sessions).toEqual(input.sessions);
  });

  it("reads a legacy single-output job as a Campaign with one Artifact", async () => {
    const input = employeeActivityInputSchema.parse(normal);
    const { document } = await generateCopy(input);
    const now = "2026-09-03T00:00:00.000Z";
    const legacyJob = {
      id: "22dfdc6b-1cce-49e5-8687-d88f42c0de72",
      traceId: "874636fd-50cd-4762-9844-e1d024393e2b",
      idempotencyKey: "d5e1c8d2-af06-4e65-a5b6-1c61c9dca8e2",
      actionIdempotencyKeys: [],
      userId: "legacy-user",
      input,
      status: "READY_FOR_REVIEW",
      currentStep: "等待预览确认",
      retryCount: 0,
      versions: [
        {
          id: "5822de39-108e-4592-937f-805420277bf2",
          createdAt: now,
          posterDocument: document,
          outputFormat: "portrait_1080x1920",
          templateVersion: "1.6.0",
          promptVersion: "employee-activity-copy-v1-6",
          illustrationPromptVersion: "illustration-brief-v1",
          modelInfo: {
            copyProvider: "deepseek",
            copyModel: "deepseek-chat",
            compilerProvider: "deepseek",
            imageProvider: "seedream",
            imageModel: "seedream"
          },
          assetMode: "generated",
          assetPath: "/tmp/legacy-image.png",
          outputPath: "/tmp/legacy-poster.png",
          validation: { passed: true, messages: [] }
        }
      ],
      createdAt: now,
      updatedAt: now
    } satisfies Omit<GenerationJob, "campaignBrief" | "artifacts">;

    const normalized = normalizeStoredJob(legacyJob);

    expect(normalized.campaignBrief.renderTargets).toHaveLength(4);
    expect(normalized.artifacts).toHaveLength(1);
    expect(normalized.artifacts[0]).toMatchObject({
      renderTargetId: "portrait_1080x1920",
      status: "READY",
      width: 1080,
      height: 1920
    });
  });

  it("keeps Phase 1.5 and earliest single-session history readable", () => {
    const now = "2026-09-03T00:00:00.000Z";
    const common = {
      id: "85397b74-dc13-4347-b9b2-0bfeac4eaa7b",
      traceId: "9fbf918a-951d-40ff-8805-e4afb5a9086c",
      idempotencyKey: "89802b19-9eef-4385-b4fe-775267df493b",
      actionIdempotencyKeys: [],
      userId: "legacy-user",
      status: "FAILED_FINAL" as const,
      currentStep: "历史任务",
      retryCount: 0,
      versions: [],
      createdAt: now,
      updatedAt: now
    };

    const phaseOnePointFive = normalizeStoredJob({
      ...common,
      input: {
        ...normal,
        outputFormat: undefined,
        includeQr: undefined
      }
    });
    expect(phaseOnePointFive.input.outputFormat).toBe(
      "portrait_1080x1920"
    );
    expect(phaseOnePointFive.input.includeQr).toBe(false);

    const earliest = normalizeStoredJob({
      ...common,
      id: "021c9fe2-c104-4159-a30e-497ec6e1313b",
      input: {
        activityName: "秋日同行日",
        date: "2026-09-18",
        time: "14:00–17:30",
        location: "上海总部一层多功能厅",
        description:
          "一场为同事准备的轻松秋日相聚，包含趣味互动和手作体验。",
        style: "warm"
      }
    });
    expect(earliest.input.sessions[0]).toMatchObject({
      date: "2026-09-18",
      time: "14:00–17:30",
      location: "上海总部一层多功能厅"
    });
    expect(earliest.campaignBrief.renderTargets).toHaveLength(4);
  });
});
