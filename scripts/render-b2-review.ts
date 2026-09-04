import { access, unlink } from "node:fs/promises";
import path from "node:path";
import {
  campaignBundleFixtures,
  type CampaignBundleFixture
} from "../tests/fixtures/campaign-bundle";
import type { PosterDocument } from "../src/contracts/poster";
import {
  PosterRenderError,
  renderEmployeeActivity
} from "../src/templates/employee-activity";

function portraitDocument(
  fixture: CampaignBundleFixture
): PosterDocument {
  const document = fixture.confirmedDocument;
  return {
    schemaVersion: "1.7",
    scene: document.scene,
    locale: document.locale,
    outputFormat: "portrait_1080x1920",
    category: document.category,
    title: document.title,
    subtitle: document.subtitle,
    summary: document.summary,
    sessions: document.sessions,
    audience: document.audience,
    highlights: document.highlights,
    participationSteps: document.participationSteps,
    notice: document.notice,
    includeQr: document.includeQr,
    ctaLabel: document.ctaLabel,
    qrPayload: document.qrPayload,
    contact: document.contact,
    immutableSource: {
      outputFormat: true,
      sessions: true,
      audience: true,
      contact: true,
      includeQr: true,
      ctaLabel: true,
      qrPayload: true,
      notice: true
    }
  };
}

async function renderFixture(fixture: CampaignBundleFixture) {
  const expected = fixture.expectedArtifacts.portrait_1080x1920.brandCheck;
  const expectedError = expected.errors[0];
  const outputId = `b2-review-${fixture.id}`;
  const outputPath = path.join(
    process.cwd(),
    "data",
    "generated",
    `${outputId}.png`
  );
  const fallback = path.join(
    process.cwd(),
    "public",
    "brand",
    "employee-activity-fallback.svg"
  );

  try {
    const rendered = await renderEmployeeActivity(
      portraitDocument(fixture),
      fallback,
      outputId
    );
    const outputPath = rendered.outputPath;
    if (expectedError) {
      throw new Error(
        `${fixture.id}: expected ${expectedError}, but generated ${outputPath}`
      );
    }
    await access(outputPath);
    console.log(`PASS ${fixture.id}: ${outputPath}`);
  } catch (error) {
    if (
      error instanceof PosterRenderError &&
      expectedError &&
      error.code === expectedError
    ) {
      await unlink(outputPath).catch((unlinkError: unknown) => {
        if (
          !(unlinkError instanceof Error) ||
          !("code" in unlinkError) ||
          unlinkError.code !== "ENOENT"
        ) {
          throw unlinkError;
        }
      });
      console.log(`EXPECTED_BLOCK ${fixture.id}: ${error.code}`);
      return;
    }
    throw error;
  }
}

async function main() {
  for (const fixture of campaignBundleFixtures) {
    await renderFixture(fixture);
  }
}

void main();
