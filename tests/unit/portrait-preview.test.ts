import { describe, expect, it } from "vitest";
import type { CampaignGenerationJob } from "@/contracts/job";
import { latestPortraitPreviewOutputPath } from "@/server/portrait-preview";

function jobWith(
  overrides: { artifacts: unknown; versions: unknown }
) {
  return overrides as CampaignGenerationJob;
}

describe("portrait preview selection", () => {
  it("keeps the last eligible portrait preview while a replacement visual is being prepared", () => {
    const job = jobWith({
      artifacts: [
        {
          renderTargetId: "portrait_1080x1920",
          status: "READY",
          outputPath: "/generated/last-approved.png",
          validation: { passed: true, messages: [] }
        }
      ],
      versions: []
    });

    expect(latestPortraitPreviewOutputPath(job)).toBe(
      "/generated/last-approved.png"
    );
  });

  it("does not create a preview URL for a blocked or in-progress artifact", () => {
    const job = jobWith({
      artifacts: [
        {
          renderTargetId: "portrait_1080x1920",
          status: "READY",
          outputPath: "/generated/blocked.png",
          validation: { passed: false, exportAllowed: false, messages: [] }
        },
        {
          renderTargetId: "portrait_1080x1920",
          status: "RENDERING",
          outputPath: "/generated/rendering.png",
          validation: { passed: false, exportAllowed: false, messages: [] }
        }
      ],
      versions: []
    });

    expect(latestPortraitPreviewOutputPath(job)).toBeUndefined();
  });

  it("uses the latest eligible legacy portrait version when no portrait artifact exists", () => {
    const job = jobWith({
      artifacts: [],
      versions: [
        {
          outputFormat: "portrait_1080x1920",
          outputPath: "/generated/old.png",
          validation: { passed: true, messages: [] }
        },
        {
          outputFormat: "portrait_1080x1920",
          outputPath: "/generated/new-blocked.png",
          validation: { passed: false, exportAllowed: false, messages: [] }
        }
      ]
    });

    expect(latestPortraitPreviewOutputPath(job)).toBe("/generated/old.png");
  });
});
