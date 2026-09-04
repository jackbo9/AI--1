import crypto from "node:crypto";
import path from "node:path";
import { posterDocumentSchema } from "../src/contracts/poster";
import { extraFormats, renderT01Extra, ExtraRenderError } from "../src/templates/t01-extra-renderer";

// Deterministic local fixtures only: this script never calls a model.
const document = posterDocumentSchema.parse({
  schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN", outputFormat: "portrait_1080x1920",
  category: "competition", title: "赛事主题", subtitle: "一起运动，享受友好竞赛的乐趣。", summary: "一起运动，享受友好竞赛的乐趣。",
  sessions: [{ label: "第一场", date: "2026-09-18", time: "18:30–20:30", location: "园区体育馆", details: [] }],
  audience: "全体员工", highlights: [], participationSteps: [], notice: "", includeQr: true,
  ctaLabel: "请选择适合自己的场次报名。", qrPayload: "https://example.com/register", qrAssetId: "", contact: "行政服务台", deadline: "9月16日 18:00",
  rules: "比赛项目：羽毛球双打\n\n赛制与晋级：小组循环赛，三局两胜。\n\n注意事项：请穿着运动鞋，提前到场。", prize: "",
  immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true }
});
const imagePath = path.resolve(process.argv[2] ?? "public/brand/employee-activity-fallback.svg");
const outputDirectory = path.join(process.cwd(), "tmp/t01-formats-review");
async function main() {
  for (const format of extraFormats) {
    const sample = format === "landscape_1920x1080" ? { ...document, rules: "小组循环赛，三局两胜。" } : document;
    const result = await renderT01Extra(format, sample, imagePath, format.replaceAll("_", "-"), { outputDirectory, readabilityMode: "trial" });
    console.log(JSON.stringify({ format, width: result.width, height: result.height, path: result.outputPath, contrast: result.contrast?.passed ?? "not-sampled" }));
  }
  const empty = { ...document, subtitle: "", summary: "", rules: "", includeQr: false, qrPayload: "", contact: "", deadline: "", ctaLabel: "" };
  const short = await renderT01Extra("longform_1080xAuto", empty, imagePath, "longform-empty", { outputDirectory });
  console.log(JSON.stringify({ case: "empty", height: short.height }));
  const long = { ...document, sessions: [...document.sessions, { ...document.sessions[0], label: "第二场", date: "2026-09-19" }], rules: "活动规则：" + "请在指定时间到场并遵守活动规则。".repeat(100) };
  const tall = await renderT01Extra("longform_1080xAuto", long, imagePath, "longform-long", { outputDirectory });
  if (tall.height <= short.height) throw new Error("Longform did not grow with content");
  console.log(JSON.stringify({ case: "two-sessions-long", height: tall.height }));
  try {
    await renderT01Extra("banner_2227x950", { ...document, title: "超长活动标题".repeat(10) }, imagePath, crypto.randomUUID(), { outputDirectory });
    throw new Error("Expected title overflow to block output");
  } catch (error) {
    if (!(error instanceof ExtraRenderError) || error.code !== "TEMPLATE_CONTENT_OVERFLOW") throw error;
    console.log("Long title correctly blocked before output");
  }
}
void main();
