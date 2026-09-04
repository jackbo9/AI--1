export const T01_SCRIM_STRENGTHS = [0, 0.12, 0.2, 0.28, 0.36] as const;

export type T01ScrimStrength = (typeof T01_SCRIM_STRENGTHS)[number];

export const T01_TEXT_TREATMENTS = [
  "dark_text_clean",
  "dark_text_light_scrim",
  "light_text_dark_scrim",
  "fallback_background"
] as const;

export type T01TextTreatment = (typeof T01_TEXT_TREATMENTS)[number];
export type T01TextTone = "dark" | "light";
export type T01LogoVariant = "primary" | "inverse";
export type T01ReadabilityRegion =
  | "header"
  | "title"
  | "sessions"
  | "audience"
  | "participation"
  | "qr"
  | "footer";

export type T01Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type T01RegionDefinition = {
  id: T01ReadabilityRegion;
  bounds: T01Rect;
  minimumContrast: number;
};

/**
 * These bounds are evaluated against the 1080 × 1920 cover crop, never the
 * source image. `title` includes its supporting subtitle because its smaller
 * 28 px copy has the stricter release threshold.
 */
export const T01_READABILITY_REGIONS: readonly T01RegionDefinition[] = [
  { id: "header", bounds: { x: 72, y: 80, width: 936, height: 83 }, minimumContrast: 3 },
  { id: "title", bounds: { x: 81, y: 223, width: 720, height: 251 }, minimumContrast: 4.5 },
  { id: "sessions", bounds: { x: 72, y: 1366, width: 936, height: 103 }, minimumContrast: 4.5 },
  { id: "audience", bounds: { x: 72, y: 1477, width: 936, height: 103 }, minimumContrast: 4.5 },
  { id: "participation", bounds: { x: 72, y: 1588, width: 717, height: 158 }, minimumContrast: 4.5 },
  { id: "qr", bounds: { x: 864, y: 1732, width: 144, height: 26 }, minimumContrast: 4.5 },
  { id: "footer", bounds: { x: 72, y: 1815, width: 936, height: 26 }, minimumContrast: 4.5 }
] as const;

export type T01ContrastCheck = {
  passRate: number;
  p05Contrast: number;
  minimumContrast: number;
  passed: boolean;
};

export type T01CandidateMeasurement = T01ContrastCheck & {
  treatment: Exclude<T01TextTreatment, "fallback_background">;
  scrimStrength: T01ScrimStrength;
};

export type T01RegionAnalysis = {
  id: T01ReadabilityRegion;
  bounds: T01Rect;
  luminance: { p05: number; p50: number; p95: number };
  edgeDensity: number;
  candidates: T01CandidateMeasurement[];
};

export type T01ZoneTreatment = {
  treatment: Exclude<T01TextTreatment, "fallback_background">;
  textTone: T01TextTone;
  scrimStrength: T01ScrimStrength;
  bounds: T01Rect;
};

export type T01ReadabilityReport = {
  contractVersion: "t01-readability-v1";
  backgroundMode: "input" | "fallback";
  fallbackReason?: "no_input_treatment_passed";
  logoVariant: T01LogoVariant;
  treatments: Record<T01ReadabilityRegion, T01ZoneTreatment>;
  initialAnalysis: T01RegionAnalysis[];
  finalAnalysis: T01RegionAnalysis[];
  passed: boolean;
};

export type T01ScrimMask = Pick<
  T01ZoneTreatment,
  "treatment" | "scrimStrength" | "bounds"
>;

const PASS_RATE = 0.95;

export function contrastPasses(input: {
  passRate: number;
  p05Contrast: number;
  minimumContrast: number;
}): boolean {
  return input.passRate >= PASS_RATE && input.p05Contrast >= input.minimumContrast;
}

export function selectZoneTreatment(
  analysis: T01RegionAnalysis
): T01ZoneTreatment | undefined {
  const candidates =
    analysis.luminance.p50 < 0.18
      ? [
          ...analysis.candidates.filter(
            (item) => item.treatment === "light_text_dark_scrim"
          ),
          ...analysis.candidates.filter(
            (item) => item.treatment !== "light_text_dark_scrim"
          )
        ]
      : analysis.candidates;
  const candidate = candidates.find((item) => item.passed);
  if (!candidate) return undefined;

  return {
    treatment: candidate.treatment,
    textTone: candidate.treatment === "light_text_dark_scrim" ? "light" : "dark",
    scrimStrength: candidate.scrimStrength,
    bounds: analysis.bounds
  };
}

export function selectT01Treatments(
  analysis: T01RegionAnalysis[]
): Record<T01ReadabilityRegion, T01ZoneTreatment> | undefined {
  const selections = analysis.map((region) => [region.id, selectZoneTreatment(region)] as const);
  if (selections.some(([, selection]) => !selection)) return undefined;
  return Object.fromEntries(selections) as Record<T01ReadabilityRegion, T01ZoneTreatment>;
}

export function logoVariantForTreatment(
  treatments: Record<T01ReadabilityRegion, T01ZoneTreatment>
): T01LogoVariant {
  return treatments.header.textTone === "light" ? "inverse" : "primary";
}

export function t01ScrimMasks(
  treatments: Record<T01ReadabilityRegion, T01ZoneTreatment>
): T01ScrimMask[] {
  const masks: T01ScrimMask[] = [];
  const sessionTreatment = treatments.sessions;
  const audienceTreatment = treatments.audience;
  const mergeInfo =
    sessionTreatment.treatment === audienceTreatment.treatment &&
    sessionTreatment.scrimStrength === audienceTreatment.scrimStrength &&
    sessionTreatment.scrimStrength > 0;

  if (mergeInfo) {
    masks.push({
      treatment: sessionTreatment.treatment,
      scrimStrength: sessionTreatment.scrimStrength,
      bounds: {
        x: Math.min(sessionTreatment.bounds.x, audienceTreatment.bounds.x),
        y: Math.min(sessionTreatment.bounds.y, audienceTreatment.bounds.y),
        width: Math.max(
          sessionTreatment.bounds.x + sessionTreatment.bounds.width,
          audienceTreatment.bounds.x + audienceTreatment.bounds.width
        ) - Math.min(sessionTreatment.bounds.x, audienceTreatment.bounds.x),
        height:
          Math.max(
            sessionTreatment.bounds.y + sessionTreatment.bounds.height,
            audienceTreatment.bounds.y + audienceTreatment.bounds.height
          ) - Math.min(sessionTreatment.bounds.y, audienceTreatment.bounds.y)
      }
    });
  }

  (Object.keys(treatments) as T01ReadabilityRegion[]).forEach((region) => {
    if (mergeInfo && (region === "sessions" || region === "audience")) return;
    const treatment = treatments[region];
    if (treatment.scrimStrength) {
      masks.push({
        treatment: treatment.treatment,
        scrimStrength: treatment.scrimStrength,
        bounds: treatment.bounds
      });
    }
  });
  return masks;
}
