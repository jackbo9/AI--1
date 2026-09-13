import path from "node:path";
import { describe, expect, it } from "vitest";
import normal from "../fixtures/employee-activity.normal.json";
import { employeeActivityInputSchema, posterDocumentSchema } from "@/contracts/poster";
import { renderT01Extra } from "@/templates/t01-extra-renderer";
import { rosterLayout } from "@/templates/t01-roster-layout";

const input = employeeActivityInputSchema.parse({ ...normal, includeQr: false, qrPayload: "", qrAssetId: "" });
const document = posterDocumentSchema.parse({
  ...input, schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN",
  title: "羽球赛", slogan: "九号员工羽球赛 / BADMINTON", subtitle: "一起上场", summary: "",
  immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true }
});
const asset = path.join(process.cwd(), "public/brand/employee-activity-fallback.svg");
const options = { readabilityMode: "trial" as const, outputDirectory: path.join(process.cwd(), "test-results/roster-render") };

describe("editable roster final rendering", () => {
  it("renders renamed groups using the same height calculation as the draft", async () => {
    const groups = [{ label: "公开组", entrants: [{ name: "张三", region: "华东" }, { name: "李四", region: "华南" }] }];
    const result = await renderT01Extra("longform_1080xAuto", { ...document, finalistGroups: groups }, asset, "renamed-roster", options);
    expect(result.height).toBe(Math.ceil(rosterLayout(groups).height));
    expect(result.checks.capacity).toBe(true);
  }, 30000);
  it("blocks long names instead of overlapping adjacent rows", async () => {
    const groups = [{ label: "公开组", entrants: [{ name: "很长的姓名很长的姓名", region: "华东" }] }];
    await expect(renderT01Extra("longform_1080xAuto", { ...document, finalistGroups: groups }, asset, "overflow-roster", options)).rejects.toMatchObject({ code: "TEMPLATE_CONTENT_OVERFLOW" });
  }, 30000);
});
