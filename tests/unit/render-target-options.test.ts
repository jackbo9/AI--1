import { describe, expect, it } from "vitest";
import {
  renderTargetOption,
  renderTargetOptions,
  selectedRenderTarget
} from "@/components/activity-studio/render-target-options";

describe("activity studio render target options", () => {
  it("keeps the four template labels and output sizes in one ordered contract", () => {
    expect(renderTargetOptions).toEqual([
      { id: "portrait_1080x1920", label: "竖版", size: "1080 × 1920" },
      { id: "landscape_1920x1080", label: "横版", size: "1920 × 1080" },
      { id: "banner_2227x950", label: "Banner", size: "2227 × 950" },
      { id: "longform_1080xAuto", label: "长图", size: "1080 × 3000" }
    ]);
    expect(renderTargetOption("banner_2227x950").label).toBe("Banner");
  });

  it("preserves the selected Step 1 size and falls back inside the selected set", () => {
    const targets = ["landscape_1920x1080", "longform_1080xAuto"] as const;
    expect(selectedRenderTarget([...targets], "longform_1080xAuto")).toBe(
      "longform_1080xAuto"
    );
    expect(selectedRenderTarget([...targets], "portrait_1080x1920")).toBe(
      "landscape_1920x1080"
    );
  });
});
