import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateIllustration, seedreamPrompt, type IllustrationResult } from "../src/providers/illustration-provider";
import { briefFromConfirmedDescription, t01VisualStyleContract } from "../src/providers/prompt-compiler";
import { extraFormats, renderT01Extra } from "../src/templates/t01-extra-renderer";
import { renderEmployeeActivity } from "../src/templates/employee-activity";
import { employeeActivityInputSchema, posterDocumentSchema } from "../src/contracts/poster";
import normal from "../tests/fixtures/employee-activity.normal.json";

async function main() {
  const reuse = process.argv.includes("--render-existing");
  if (!reuse && process.env.ALLOW_PAID_MODEL_PROBE !== "1") throw new Error("This comparison requires two paid image calls; set ALLOW_PAID_MODEL_PROBE=1 explicitly.");
  const description = "羽毛球与蓝色球拍拍面接触的瞬间，器材超近景，真实高速摄影，无人物，蓝白主色，主视觉中部偏右，外围干净自然。";
  const input = employeeActivityInputSchema.parse({ ...normal, activityName: "羽球挑战", includeQr: true, qrPayload: "https://example.com/register", qrAssetId: "", description: "一起挥拍，享受运动。" });
  const current = briefFromConfirmedDescription(description, { ...input, visualIntent: description });
  const legacy = { subject: "企业同事与活动主体", action: description.slice(0, 80), setting: description.slice(0, 80), composition: description, palette: "黑白灰基底、浅色自然光与少量行政黄", style: t01VisualStyleContract, mood: "温暖、可信、自然", negative: "不要文字、字母、数字、Logo、二维码、水印、签名" as const };
  const directory = path.join(process.cwd(), "tmp/visual-direction-review");
  await mkdir(directory, { recursive: true });
  const document = posterDocumentSchema.parse({ ...input, schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN", title: input.activityName, subtitle: input.description, summary: input.description, rules: "友好切磋，遵守现场安排", immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true } });
  for (const [name, brief] of [["legacy", legacy], ["editorial", current]] as const) {
    if (!reuse) await writeFile(path.join(directory, `${name}-prompt.txt`), seedreamPrompt(brief));
    const result: IllustrationResult = reuse
      ? JSON.parse(await readFile(path.join(directory, `${name}-source.json`), "utf8")) as IllustrationResult
      : await generateIllustration(brief, `visual-direction-${name}-${Date.now()}`);
    if (result.mode !== "generated") throw new Error(`Comparison ${name} failed: ${result.detail}`);
    await writeFile(path.join(directory, `${name}-source.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ name, image: result.path }));
    if (name === "editorial") {
      const portrait = await renderEmployeeActivity(document, result.path, `direction-portrait-${Date.now()}`, { readabilityMode: "trial" });
      console.log(JSON.stringify({ format: "portrait", output: portrait.outputPath }));
      for (const format of extraFormats) {
        const rendered = await renderT01Extra(format, document, result.path, `direction-${format.replaceAll("_", "-")}`, { outputDirectory: directory, readabilityMode: "trial" });
        console.log(JSON.stringify({ format, output: rendered.outputPath, width: rendered.width, height: rendered.height }));
      }
    }
  }
}
void main();
