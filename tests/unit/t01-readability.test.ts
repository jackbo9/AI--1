import { describe, expect, it } from "vitest";
import {
  contrastPasses,
  logoVariantForTreatment,
  selectT01Treatments,
  type T01RegionAnalysis
} from "@/templates/t01-readability";

function analysis(
  id: T01RegionAnalysis["id"],
  p50: number,
  candidates: T01RegionAnalysis["candidates"]
): T01RegionAnalysis {
  return {
    id,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    luminance: { p05: p50, p50, p95: p50 },
    edgeDensity: 0,
    candidates
  };
}

const passingDark = {
  treatment: "dark_text_light_scrim" as const,
  scrimStrength: 0.2 as const,
  passRate: 1,
  p05Contrast: 5,
  minimumContrast: 4.5,
  passed: true
};

const passingLight = {
  treatment: "light_text_dark_scrim" as const,
  scrimStrength: 0 as const,
  passRate: 1,
  p05Contrast: 6,
  minimumContrast: 4.5,
  passed: true
};

describe("T01 readability treatment", () => {
  it("requires both 95% pass rate and the fifth-percentile threshold", () => {
    expect(
      contrastPasses({ passRate: 0.95, p05Contrast: 4.5, minimumContrast: 4.5 })
    ).toBe(true);
    expect(
      contrastPasses({ passRate: 1, p05Contrast: 4.49, minimumContrast: 4.5 })
    ).toBe(false);
  });

  it("uses the lowest passing light scrim for a mid-light textured region", () => {
    const selection = selectT01Treatments(
      ["header", "title", "sessions", "audience", "participation", "qr", "footer"].map(
        (id) =>
          analysis(id as T01RegionAnalysis["id"], 0.36, [
            {
              treatment: "dark_text_clean",
              scrimStrength: 0,
              passRate: 0.74,
              p05Contrast: 3.9,
              minimumContrast: 4.5,
              passed: false
            },
            passingDark,
            passingLight
          ])
      )
    );
    expect(selection?.sessions).toMatchObject({
      treatment: "dark_text_light_scrim",
      scrimStrength: 0.2,
      textTone: "dark"
    });
  });

  it("selects the formal inverse company logo for dark header treatment", () => {
    const selections = selectT01Treatments(
      ["header", "title", "sessions", "audience", "participation", "qr", "footer"].map(
        (id) =>
          analysis(id as T01RegionAnalysis["id"], 0.08, [
            passingDark,
            passingLight
          ])
      )
    );
    expect(selections).toBeDefined();
    expect(logoVariantForTreatment(selections!)).toBe("inverse");
  });
});
