import { describe, expect, it } from "vitest";
import { defaultRenderTargetIds } from "@/contracts/brand";
import {
  campaignBriefSchema,
  confirmedCampaignDocumentSchema
} from "@/contracts/poster";
import { activityTemplateFamilyManifest } from "@/templates/activity-template-family";
import { campaignBundleFixtures } from "../fixtures/campaign-bundle";

describe("four-target campaign fixture suite", () => {
  it("covers every required P0 boundary", () => {
    expect(campaignBundleFixtures.map((fixture) => fixture.id)).toEqual([
      "normal",
      "two-sessions",
      "competition",
      "title-three-lines",
      "title-overflow",
      "missing-optional",
      "with-qr",
      "long-copy",
      "image-fallback"
    ]);
  });

  it.each(campaignBundleFixtures)(
    "validates $id and declares all four Artifact expectations",
    (fixture) => {
      const campaign = campaignBriefSchema.parse(fixture.campaignBrief);
      const document = confirmedCampaignDocumentSchema.parse(
        fixture.confirmedDocument
      );

      expect(Object.keys(fixture.expectedArtifacts)).toEqual(
        defaultRenderTargetIds
      );
      expect(document.sessions).toEqual(campaign.sessions);
      expect(document.notice).toBe(campaign.notice);
      expect(document.includeQr).toBe(campaign.includeQr);
      expect(document.qrPayload).toBe(campaign.qrPayload);

      for (const targetId of defaultRenderTargetIds) {
        const expected = fixture.expectedArtifacts[targetId];
        const manifest =
          activityTemplateFamilyManifest.renderTargets[targetId];
        expect(expected.width).toBe(manifest.dimensions.width);
        expect(expected.heightMode).toBe(manifest.dimensions.heightMode);

        if (
          expected.heightMode === "fixed" &&
          manifest.dimensions.heightMode === "fixed"
        ) {
          expect(expected.height).toBe(manifest.dimensions.height);
        }

        if (
          expected.heightMode === "auto" &&
          manifest.dimensions.heightMode === "auto"
        ) {
          expect(expected.minHeight).toBeGreaterThanOrEqual(
            manifest.dimensions.minHeight
          );
          expect(expected.maxHeight).toBeLessThanOrEqual(
            manifest.dimensions.maxHeight
          );
          expect(expected.maxHeight).toBeGreaterThan(expected.minHeight);
        }
      }
    }
  );

  it("marks blocking and fallback expectations explicitly", () => {
    const overflow = campaignBundleFixtures.find(
      (fixture) => fixture.id === "title-overflow"
    );
    const longCopy = campaignBundleFixtures.find(
      (fixture) => fixture.id === "long-copy"
    );
    const fallback = campaignBundleFixtures.find(
      (fixture) => fixture.id === "image-fallback"
    );

    expect(
      Object.values(overflow!.expectedArtifacts).every(
        (artifact) =>
          !artifact.brandCheck.passed &&
          artifact.brandCheck.errors.includes("brand.title.max_lines")
      )
    ).toBe(true);
    expect(
      longCopy!.expectedArtifacts.portrait_1080x1920.brandCheck.errors
    ).toContain("content.capacity");
    expect(
      fallback!.expectedArtifacts.longform_1080xAuto.brandCheck.warnings
    ).toContain("visual.asset_fallback");
  });
});
