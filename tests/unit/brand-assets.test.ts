import { stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { brandAssetPaths } from "@/templates/brand-header";
import {
  employeeActivityPosterMarkup,
  employeeActivityTemplate
} from "@/templates/employee-activity";
import { loadEmbeddedBrandAssets } from "@/templates/brand-header";
import normal from "../fixtures/employee-activity.normal.json";
import {
  employeeActivityInputSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import { activityTemplateFamilyManifest } from "@/templates/activity-template-family";

describe("B1 formal brand assets", () => {
  it("ships both official marks and the required MiSans weights", async () => {
    const files = [
      brandAssetPaths.companyLogo,
      brandAssetPaths.administrationMark,
      brandAssetPaths.fonts.regular,
      brandAssetPaths.fonts.semibold
    ];
    const sizes = await Promise.all(files.map((file) => stat(file)));

    expect(sizes[0].size).toBeGreaterThan(1_000);
    expect(sizes[1].size).toBeGreaterThan(1_000);
    expect(sizes.slice(2).every((file) => file.size > 1_000_000)).toBe(true);
  });

  it("requires both brand marks and embeds MiSans in the rendered poster", async () => {
    const input = employeeActivityInputSchema.parse(normal);
    const document = posterDocumentSchema.parse({
      schemaVersion: "1.7",
      scene: "employee_activity",
      locale: "zh-CN",
      outputFormat: "portrait_1080x1920",
      category: input.category,
      title: input.activityName,
      subtitle: "",
      summary: input.description,
      sessions: input.sessions,
      audience: input.audience,
      highlights: input.highlights,
      participationSteps: input.participationSteps,
      notice: input.notice,
      includeQr: false,
      ctaLabel: input.ctaLabel,
      qrPayload: input.qrPayload,
      contact: input.contact,
      immutableSource: {
        outputFormat: true,
        sessions: true,
        audience: true,
        contact: true,
        includeQr: true,
        ctaLabel: true,
        qrPayload: true,
        qrAssetId: true,
        notice: true
      }
    });
    const markup = employeeActivityPosterMarkup(
      document,
      "data:image/svg+xml;base64,PHN2Zy8+",
      "",
      await loadEmbeddedBrandAssets()
    );

    expect(markup).toContain("data-brand-company-logo");
    expect(markup).toContain("data-brand-administration-mark");
    expect(markup).toContain('font-family:"MiSans"');
    expect(markup).toContain('class="background"');
    expect(employeeActivityTemplate.slots).toContain("full_bleed_background");
    expect(employeeActivityTemplate.overflowRules.title).toBe("block_export");
  });

  it("aligns the implemented portrait template with the B2 manifest", () => {
    const portrait =
      activityTemplateFamilyManifest.renderTargets.portrait_1080x1920;
    expect(portrait.templateId).toBe(employeeActivityTemplate.id);
    expect(portrait.templateVersion).toBe(employeeActivityTemplate.version);
    expect(portrait.logoZones.company).toMatchObject({
      x: 72,
      y: 80,
      width: 280
    });
    expect(portrait.qrZone).toMatchObject({
      x: 864,
      y: 1574,
      width: 144,
      height: 144
    });
  });

  it("declares the T01 slot projection without legacy cards or CTA", () => {
    expect(employeeActivityTemplate.slots).toEqual([
      "brand_header", "full_bleed_background", "title", "subtitle", "sessions", "audience", "participation", "qr", "footer"
    ]);
    expect(activityTemplateFamilyManifest.renderTargets.portrait_1080x1920.overflow.titleMaxLines).toBe(1);
  });

  it("omits the complete QR region when the input does not enable it", async () => {
    const input = employeeActivityInputSchema.parse(normal);
    const document = posterDocumentSchema.parse({
      schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN", outputFormat: "portrait_1080x1920", category: input.category,
      title: input.activityName, subtitle: "", summary: input.description, sessions: input.sessions, audience: input.audience,
      highlights: input.highlights, participationSteps: input.participationSteps, notice: input.notice, includeQr: false, ctaLabel: "保留文案不应显示", qrPayload: "", contact: input.contact,
      immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true }
    });
    const markup = employeeActivityPosterMarkup(document, "data:image/svg+xml;base64,PHN2Zy8+", "", await loadEmbeddedBrandAssets());
    expect(markup).not.toContain("data-poster-qr");
    expect(markup).not.toContain("cta-arrow");
    expect(markup).not.toContain("保留文案不应显示");
  });
});
