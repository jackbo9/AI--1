import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { campaignBundleFixtures } from "../tests/fixtures/campaign-bundle";
import type { PosterDocument } from "../src/contracts/poster";
import { renderEmployeeActivity } from "../src/templates/employee-activity";

const document = (() => {
  const source = campaignBundleFixtures.find((fixture) => fixture.id === "normal");
  if (!source) throw new Error("缺少 normal 海报 Fixture");
  const item = source.confirmedDocument;
  return {
    schemaVersion: "1.7",
    scene: item.scene,
    locale: item.locale,
    outputFormat: "portrait_1080x1920",
    category: item.category,
    title: item.title,
    subtitle: item.subtitle,
    summary: item.summary,
    sessions: item.sessions,
    audience: item.audience,
    highlights: item.highlights,
    participationSteps: item.participationSteps,
    notice: item.notice,
    includeQr: true,
    ctaLabel: "扫码参与",
    qrPayload: "https://example.com/t01-readability",
    contact: item.contact,
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
  } satisfies PosterDocument;
})();

const fixtureRoot = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "t01-readability"
);
type ReadabilityFixture = {
  id: string;
  file: string;
  fallback?: boolean;
  absolute?: boolean;
};

const cases: readonly ReadabilityFixture[] = [
  { id: "light-low-texture", file: "light-low-texture.svg" },
  { id: "dark-low-texture", file: "dark-low-texture.svg" },
  { id: "autumn-high-texture", file: "autumn-high-texture.svg" },
  { id: "light-title-dark-copy", file: "light-title-dark-copy.svg" },
  { id: "dark-title-light-copy", file: "dark-title-light-copy.svg" },
  { id: "checker-fallback", file: "checker-fallback.svg", fallback: true },
  {
    id: "default-fallback",
    file: path.join(
      process.cwd(),
      "public",
      "brand",
      "employee-activity-fallback.svg"
    ),
    absolute: true
  }
] as const;

function fixturePath(item: ReadabilityFixture) {
  return item.absolute ? item.file : path.join(fixtureRoot, item.file);
}

function digest(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function renderCase(item: ReadabilityFixture) {
  const source = fixturePath(item);
  const first = await renderEmployeeActivity(
    document,
    source,
    "t01-readability-" + item.id
  );
  const second = await renderEmployeeActivity(
    document,
    source,
    "t01-readability-" + item.id + "-repeat"
  );
  const [firstBytes, secondBytes] = await Promise.all([
    readFile(first.outputPath),
    readFile(second.outputPath)
  ]);
  if (!first.readability.passed || !second.readability.passed) {
    throw new Error(item.id + ": 对比度发布门未通过");
  }
  if (digest(firstBytes) !== digest(secondBytes)) {
    throw new Error(item.id + ": 重复渲染的 PNG 不一致");
  }
  if (item.fallback && first.readability.backgroundMode !== "fallback") {
    throw new Error(item.id + ": 未触发品牌降级背景");
  }
  const details = Object.entries(first.readability.treatments)
    .map(
      ([region, treatment]) =>
        region +
        "=" +
        treatment.treatment +
        "@" +
        treatment.scrimStrength
    )
    .join(", ");
  console.log(
    "PASS " +
      item.id +
      " logo=" +
      first.readability.logoVariant +
      " background=" +
      first.readability.backgroundMode +
      " " +
      details +
      " " +
      first.outputPath
  );
}

async function main() {
  for (const item of cases) {
    await renderCase(item);
  }
}

void main();
