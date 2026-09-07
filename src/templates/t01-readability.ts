export type T01ScrimStrength = 0;

export const T01_TEXT_TREATMENTS = [
  "dark_text_clean",
  "light_text_clean"
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

/**
 * These regions form one nearby information block in the portrait template.
 * Time and location are both contained by `sessions`; audience and
 * participation sit directly below it. They must use one shared text tone so
 * the block cannot alternate between black and white.
 */
export const T01_UNIFIED_INFO_REGIONS = [
  "sessions",
  "audience",
  "participation"
] as const satisfies readonly T01ReadabilityRegion[];

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
 * 28 px copy has the stricter release threshold. The bounds cover the new
 * three-line title plus two-line subtitle area.
 */
export const T01_READABILITY_REGIONS: readonly T01RegionDefinition[] = [
  { id: "header", bounds: { x: 72, y: 80, width: 936, height: 83 }, minimumContrast: 3 },
  { id: "title", bounds: { x: 80, y: 223, width: 920, height: 526.2 }, minimumContrast: 4.5 },
  { id: "sessions", bounds: { x: 72, y: 1283, width: 936, height: 160 }, minimumContrast: 4.5 },
  { id: "audience", bounds: { x: 72, y: 1459, width: 936, height: 76 }, minimumContrast: 4.5 },
  { id: "participation", bounds: { x: 72, y: 1551, width: 717, height: 160 }, minimumContrast: 4.5 },
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
  treatment: T01TextTreatment;
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
  treatment: T01TextTreatment;
  textTone: T01TextTone;
  scrimStrength: T01ScrimStrength;
  bounds: T01Rect;
};

export type T01ReadabilityReport = {
  contractVersion: "t01-readability-v1";
  backgroundMode: "input";
  logoVariant: T01LogoVariant;
  treatments: Record<T01ReadabilityRegion, T01ZoneTreatment>;
  initialAnalysis: T01RegionAnalysis[];
  finalAnalysis: T01RegionAnalysis[];
  passed: boolean;
};

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
            (item) => item.treatment === "light_text_clean"
          ),
          ...analysis.candidates.filter(
            (item) => item.treatment !== "light_text_clean"
          )
        ]
      : analysis.candidates;
  const candidate = candidates.find((item) => item.passed);
  if (!candidate) return undefined;

  return {
    treatment: candidate.treatment,
    textTone: candidate.treatment === "light_text_clean" ? "light" : "dark",
    scrimStrength: candidate.scrimStrength,
    bounds: analysis.bounds
  };
}

export function selectT01Treatments(
  analysis: T01RegionAnalysis[],
  options: { allowWarnings?: boolean } = {}
): Record<T01ReadabilityRegion, T01ZoneTreatment> | undefined {
  const unifiedInfoIds = new Set<T01ReadabilityRegion>(
    T01_UNIFIED_INFO_REGIONS
  );
  const unifiedInfo = analysis.filter((region) =>
    unifiedInfoIds.has(region.id)
  );
  const unifiedSelections =
    unifiedInfo.length === T01_UNIFIED_INFO_REGIONS.length
      ? selectUnifiedInfoTreatments(unifiedInfo, options)
      : undefined;
  if (!unifiedSelections) return undefined;

  const selections = analysis.map((region) => [
    region.id,
    unifiedInfoIds.has(region.id)
      ? unifiedSelections[region.id]
      : options.allowWarnings
        ? selectZoneTreatmentWithWarnings(region)
        : selectZoneTreatment(region)
  ] as const);
  if (selections.some(([, selection]) => !selection)) return undefined;
  return Object.fromEntries(selections) as Record<T01ReadabilityRegion, T01ZoneTreatment>;
}

function selectUnifiedInfoTreatments(
  analysis: T01RegionAnalysis[],
  options: { allowWarnings?: boolean }
): Partial<Record<T01ReadabilityRegion, T01ZoneTreatment>> | undefined {
  const treatments = T01_TEXT_TREATMENTS.map((treatment) => {
    const candidates = analysis.map((region) => ({
      region,
      candidate: region.candidates.find(
        (candidate) =>
          candidate.treatment === treatment && candidate.scrimStrength === 0
      )
    }));
    if (candidates.some(({ candidate }) => !candidate)) return undefined;

    const complete = candidates as Array<{
      region: T01RegionAnalysis;
      candidate: T01CandidateMeasurement;
    }>;
    const passingRegions = complete.filter(({ candidate }) => candidate.passed)
      .length;
    const p05Contrasts = complete.map(({ candidate }) => candidate.p05Contrast);
    return {
      treatment,
      candidates: complete,
      passingRegions,
      minimumP05: Math.min(...p05Contrasts),
      averageP05:
        p05Contrasts.reduce((total, value) => total + value, 0) /
        p05Contrasts.length
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const eligible = options.allowWarnings
    ? treatments
    : treatments.filter(
        ({ passingRegions }) => passingRegions === analysis.length
      );
  const selected = eligible.sort((left, right) => {
    if (right.passingRegions !== left.passingRegions) {
      return right.passingRegions - left.passingRegions;
    }
    if (right.minimumP05 !== left.minimumP05) {
      return right.minimumP05 - left.minimumP05;
    }
    if (right.averageP05 !== left.averageP05) {
      return right.averageP05 - left.averageP05;
    }
    return left.treatment === "dark_text_clean" ? -1 : 1;
  })[0];
  if (!selected) return undefined;

  return Object.fromEntries(
    selected.candidates.map(({ region, candidate }) => [
      region.id,
      {
        treatment: candidate.treatment,
        textTone:
          candidate.treatment === "light_text_clean" ? "light" : "dark",
        scrimStrength: candidate.scrimStrength,
        bounds: region.bounds
      }
    ])
  );
}

function selectZoneTreatmentWithWarnings(
  analysis: T01RegionAnalysis
): T01ZoneTreatment | undefined {
  const candidates = analysis.candidates
    .filter((candidate) => candidate.scrimStrength === 0)
    .sort((left, right) => {
      if (left.passed !== right.passed) return left.passed ? -1 : 1;
      if (right.p05Contrast !== left.p05Contrast) return right.p05Contrast - left.p05Contrast;
      return left.scrimStrength - right.scrimStrength;
    });
  const candidate = candidates[0];
  if (!candidate) return undefined;
  return {
    treatment: candidate.treatment,
    textTone: candidate.treatment === "light_text_clean" ? "light" : "dark",
    scrimStrength: candidate.scrimStrength,
    bounds: analysis.bounds
  };
}

export function logoVariantForTreatment(
  treatments: Record<T01ReadabilityRegion, T01ZoneTreatment>
): T01LogoVariant {
  return treatments.header.textTone === "light" ? "inverse" : "primary";
}
