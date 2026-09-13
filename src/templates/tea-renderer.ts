import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
import { teaFieldsSchema, type TeaFields } from "@/contracts/tea";
import { teaMarkup, teaTemplateVersion } from "./tea-layout";
import { readGeneratedAsset } from "@/server/job-assets";

export async function renderTea(fields: TeaFields, imagePath: string, outputId: string, mode: "strict" | "trial") {
  teaFieldsSchema.parse(fields);
  if (!/^[a-zA-Z0-9-]+$/.test(outputId)) throw new Error("输出标识无效");
  const root = path.join(process.cwd(), "public/brand/tea");
  const [brand, bold, regular, image] = await Promise.all([readFile(path.join(root, "brand.svg")), readFile(path.join(root, "MiSans-Bold.ttf")), readFile(path.join(root, "MiSans-Regular.ttf")), readGeneratedAsset(imagePath)]);
  const background = await sharp(image).resize(1080, 1920, { fit: "cover", position: "bottom" }).flatten({ background: "#fff" }).png().toBuffer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await page.addInitScript("globalThis.__name = (target) => target;");
    await page.route("**/*", route => route.abort());
    await page.setContent(`<html><head><style>html,body{margin:0}svg{display:block}@font-face{font-family:TeaMiSans;src:url(data:font/ttf;base64,${bold.toString("base64")});font-weight:700}@font-face{font-family:TeaMiSans;src:url(data:font/ttf;base64,${regular.toString("base64")});font-weight:400}</style></head><body>${teaMarkup(fields, `data:image/png;base64,${background.toString("base64")}`, `data:image/svg+xml;base64,${brand.toString("base64")}`)}</body></html>`);
    const metrics = await page.evaluate(async () => {
      await Promise.all(Array.from(document.fonts).map(f => f.load()));
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll("image")).map(node => new Promise<void>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(); img.onerror = reject; img.src = node.getAttribute("href")!; })));
      return Array.from(document.querySelectorAll("text")).map(node => { const b = node.getBBox(); return { width: node.getComputedTextLength(), x: b.x, y: b.y, height: b.height }; });
    });
    if (metrics.some(m => m.width > 936)) throw new Error("文字超出安全区，请缩短后重试");
    const contrast: number[] = [];
    for (const box of metrics) {
      const bytes = await sharp(background).extract({ left: Math.max(0, Math.floor(box.x)), top: Math.max(0, Math.floor(box.y)), width: Math.max(1, Math.ceil(box.width)), height: Math.max(1, Math.ceil(box.height)) }).removeAlpha().raw().toBuffer();
      const scores: number[] = [];
      for (let i = 0; i < bytes.length; i += 3) {
        const linear = [bytes[i], bytes[i + 1], bytes[i + 2]].map(v => { const n = v / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; });
        scores.push((0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05) / 0.05);
      }
      scores.sort((a, b) => a - b);
      contrast.push(scores[Math.floor(scores.length * 0.1)]);
    }
    const passed = contrast[0] >= 3 && contrast[1] >= 4.5;
    const outputPath = path.join(process.cwd(), "data/generated", `${outputId}.png`);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath });
    return { outputPath, templateVersion: teaTemplateVersion, passed, exportAllowed: passed || mode === "trial", contrast, width: 1080, height: 1920, messages: passed ? ["字体、Logo、文字容量、尺寸与文字区对比度检查通过"] : ["文字与背景对比度待优化，请更换主视觉；食品质感与裁切需目视确认"] };
  } finally { await browser.close(); }
}
