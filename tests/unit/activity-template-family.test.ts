import { describe, expect, it } from "vitest";
import { brandSpecV1 } from "@/brand/brand-spec-v1";
import {
  activityTemplateFamilyManifest,
  activityTemplateFamilyManifestSchema
} from "@/templates/activity-template-family";

describe("employee activity template family manifest", () => {
  it("declares all four BrandSpec render targets", () => {
    const manifest = activityTemplateFamilyManifestSchema.parse(
      activityTemplateFamilyManifest
    );

    expect(Object.keys(manifest.renderTargets)).toEqual(
      brandSpecV1.defaultRenderTargets
    );
    expect(manifest.brandSpecVersion).toBe(1);
  });

  it("keeps fixed targets fixed and longform auto-height", () => {
    const { renderTargets } = activityTemplateFamilyManifest;

    expect(renderTargets.portrait_1080x1920.dimensions).toEqual({
      width: 1080,
      heightMode: "fixed",
      height: 1920
    });
    expect(renderTargets.landscape_1920x1080.dimensions).toEqual({
      width: 1920,
      heightMode: "fixed",
      height: 1080
    });
    expect(renderTargets.banner_2227x950.dimensions).toEqual({
      width: 2227,
      heightMode: "fixed",
      height: 950
    });
    expect(renderTargets.longform_1080xAuto.dimensions).toMatchObject({
      width: 1080,
      heightMode: "auto"
    });
  });

  it("records measured dual-logo placement and per-target projection", () => {
    const portrait =
      activityTemplateFamilyManifest.renderTargets.portrait_1080x1920;
    const banner =
      activityTemplateFamilyManifest.renderTargets.banner_2227x950;

    expect(portrait.logoZones.company.x).toBe(72);
    expect(portrait.logoZones.administration.x).toBe(931.5);
    expect(portrait.qrZone).toEqual({
      x: 864,
      y: 1588,
      width: 144,
      height: 144
    });
    expect(banner.modules).toEqual([
      "brand_header",
      "title",
      "primary_session",
      "footer"
    ]);
  });
});
