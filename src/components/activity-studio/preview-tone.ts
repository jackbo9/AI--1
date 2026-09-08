export type PreviewTextTone = "dark" | "light";

const darkInkLuminance = relativeLuminance(21, 21, 21);

export function choosePreviewTextTone(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): PreviewTextTone {
  const darkContrasts: number[] = [];
  const lightContrasts: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isTitleSafeAreaSample(x / width, y / height)) continue;
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3] / 255;
      const red = compositeOnWhite(pixels[offset], alpha);
      const green = compositeOnWhite(pixels[offset + 1], alpha);
      const blue = compositeOnWhite(pixels[offset + 2], alpha);
      const background = relativeLuminance(red, green, blue);
      darkContrasts.push(contrastRatio(background, darkInkLuminance));
      lightContrasts.push(contrastRatio(background, 1));
    }
  }

  if (!darkContrasts.length) return "dark";

  const darkScore = robustContrastScore(darkContrasts);
  const lightScore = robustContrastScore(lightContrasts);
  return lightScore > darkScore ? "light" : "dark";
}

function isTitleSafeAreaSample(x: number, y: number) {
  const companyLogo = x >= 0.04 && x <= 0.36 && y >= 0.03 && y <= 0.13;
  const dividerAndSlogan = x >= 0.04 && x <= 0.94 && y >= 0.13 && y <= 0.23;
  const title = x >= 0.04 && x <= 0.94 && y >= 0.22 && y <= 0.76;
  return companyLogo || dividerAndSlogan || title;
}

function robustContrastScore(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const lowerQuantile = sorted[Math.floor((sorted.length - 1) * 0.2)];
  const average =
    sorted.reduce((total, value) => total + value, 0) / sorted.length;
  return lowerQuantile * 0.7 + average * 0.3;
}

function contrastRatio(left: number, right: number) {
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function compositeOnWhite(channel: number, alpha: number) {
  return Math.round(channel * alpha + 255 * (1 - alpha));
}

function relativeLuminance(red: number, green: number, blue: number) {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
