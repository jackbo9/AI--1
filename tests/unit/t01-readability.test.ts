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
  treatment: "dark_text_clean" as const,
  scrimStrength: 0 as const,
  passRate: 1,
  p05Contrast: 5,
  minimumContrast: 4.5,
  passed: true
};

const passingLight = {
  treatment: "light_text_clean" as const,
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

  it("only selects clean text treatments without a background scrim", () => {
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
      treatment: "light_text_clean",
      scrimStrength: 0,
      textTone: "light"
    });
  });

  it("uses one shared tone for the nearby time, location, audience and participation block", () => {
    const selections = selectT01Treatments([
      analysis("header", 0.36, [passingDark, passingLight]),
      analysis("title", 0.36, [passingDark, passingLight]),
      analysis("sessions", 0.82, [
        { ...passingDark, p05Contrast: 8 },
        { ...passingLight, p05Contrast: 2, passed: false }
      ]),
      analysis("audience", 0.12, [
        { ...passingDark, p05Contrast: 2, passed: false },
        { ...passingLight, p05Contrast: 9 }
      ]),
      analysis("participation", 0.7, [
        { ...passingDark, p05Contrast: 7 },
        { ...passingLight, p05Contrast: 2.5, passed: false }
      ]),
      analysis("qr", 0.36, [passingDark, passingLight]),
      analysis("footer", 0.36, [passingDark, passingLight])
    ], { allowWarnings: true });

    expect(selections?.sessions.textTone).toBe("dark");
    expect(selections?.audience.textTone).toBe("dark");
    expect(selections?.participation.textTone).toBe("dark");
  });

  it("blocks strict selection when neither tone passes every lower information region", () => {
    const selections = selectT01Treatments([
      analysis("header", 0.36, [passingDark, passingLight]),
      analysis("title", 0.36, [passingDark, passingLight]),
      analysis("sessions", 0.82, [
        passingDark,
        { ...passingLight, passed: false }
      ]),
      analysis("audience", 0.12, [
        { ...passingDark, passed: false },
        passingLight
      ]),
      analysis("participation", 0.7, [passingDark, passingLight]),
      analysis("qr", 0.36, [passingDark, passingLight]),
      analysis("footer", 0.36, [passingDark, passingLight])
    ]);

    expect(selections).toBeUndefined();
  });

  it("selects the formal inverse company logo for a clean light-text header", () => {
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
