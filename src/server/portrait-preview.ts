import type { CampaignGenerationJob, OutputValidation } from "@/contracts/job";

function isPreviewAllowed(validation: OutputValidation) {
  return validation.exportAllowed ?? validation.passed;
}

/**
 * Keep an already approved portrait preview available while a user is
 * preparing a replacement visual. A rendering/blocked artifact must never
 * overwrite the link with a file route that will return 404.
 */
export function latestPortraitPreviewOutputPath(
  job: CampaignGenerationJob
): string | undefined {
  const artifact = [...job.artifacts]
    .reverse()
    .find(
      (item) =>
        item.renderTargetId === "portrait_1080x1920" &&
        item.status === "READY" &&
        isPreviewAllowed(item.validation) &&
        item.outputPath
    );
  if (artifact?.outputPath) return artifact.outputPath;

  return [...job.versions]
    .reverse()
    .find(
      (item) =>
        item.outputFormat === "portrait_1080x1920" &&
        isPreviewAllowed(item.validation)
    )?.outputPath;
}
