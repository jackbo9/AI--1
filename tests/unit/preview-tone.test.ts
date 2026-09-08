import { describe, expect, it } from "vitest";
import { choosePreviewTextTone } from "@/components/activity-studio/preview-tone";

describe("T01 lightweight preview tone", () => {
  it("uses light text over a dark title-safe area", () => {
    expect(choosePreviewTextTone(solidPixels(24), 20, 20)).toBe("light");
  });

  it("uses dark text over a light title-safe area", () => {
    expect(choosePreviewTextTone(solidPixels(236), 20, 20)).toBe("dark");
  });

  it("is not flipped by a small bright highlight on a dark image", () => {
    const pixels = solidPixels(24);
    for (let index = 0; index < pixels.length * 0.08; index += 4) {
      pixels[index] = 245;
      pixels[index + 1] = 245;
      pixels[index + 2] = 245;
    }
    expect(choosePreviewTextTone(pixels, 20, 20)).toBe("light");
  });
});

function solidPixels(channel: number) {
  const pixels = new Uint8ClampedArray(20 * 20 * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = channel;
    pixels[index + 1] = channel;
    pixels[index + 2] = channel;
    pixels[index + 3] = 255;
  }
  return pixels;
}
