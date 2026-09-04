import type { Page } from "playwright";

/** Sample the rendered background at each template's actual text/logo regions. */
export async function adaptWideContrast(page: Page, inverseLogo: string) {
  const regions = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-readability], [data-brand-company-logo]"));
    return nodes.map((node, index) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      node.dataset.contrastIndex = String(index);
      node.style.visibility = "hidden";
      const large = Number.parseFloat(style.fontSize) >= 24 || (Number.parseFloat(style.fontSize) >= 18.67 && Number(style.fontWeight) >= 600);
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, minimum: node.matches("img") || large ? 3 : 4.5, logo: node.matches("img") };
    });
  });
  const background = await page.screenshot({ type: "png" });
  const measurements = await page.evaluate(async ({ source, regions, inverseLogo }) => {
    const image = new Image(); image.src = source; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    function linear(value: number) { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
    return regions.map((region, index) => {
      const black: number[] = []; const white: number[] = [];
      for (let y = Math.max(0, Math.floor(region.y)); y < Math.min(canvas.height, region.y + region.height); y += 4) {
        for (let x = Math.max(0, Math.floor(region.x)); x < Math.min(canvas.width, region.x + region.width); x += 4) {
          const offset = (y * canvas.width + x) * 4;
          const luminance = 0.2126 * linear(pixels[offset]) + 0.7152 * linear(pixels[offset + 1]) + 0.0722 * linear(pixels[offset + 2]);
          black.push((luminance + 0.05) / 0.05); white.push(1.05 / (luminance + 0.05));
        }
      }
      function score(values: number[]) {
        values.sort((a, b) => a - b);
        return { rate: values.filter(value => value >= region.minimum).length / (values.length || 1), p05: values[Math.floor(values.length * 0.05)] ?? 0 };
      }
      const dark = score(black); const light = score(white);
      const useLight = light.rate > dark.rate || (light.rate === dark.rate && light.p05 > dark.p05);
      const chosen = useLight ? light : dark;
      const node = document.querySelector<HTMLElement>(`[data-contrast-index="${index}"]`)!;
      node.style.visibility = "";
      if (region.logo) {
        if (useLight) (node as HTMLImageElement).src = inverseLogo;
      } else {
        for (const child of [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))]) child.style.setProperty("color", useLight ? "#ffffff" : "#000000", "important");
      }
      return { index, tone: useLight ? "light" : "dark", ...chosen, passed: chosen.rate >= 0.95 && chosen.p05 >= region.minimum };
    });
  }, { source: `data:image/png;base64,${background.toString("base64")}`, regions, inverseLogo });
  await page.evaluate(async () => { await Promise.all(Array.from(document.images).map(image => image.decode())); });
  return { passed: measurements.length > 0 && measurements.every(item => item.passed), measurements };
}
