import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import normal from "../fixtures/employee-activity.normal.json";
import {
  employeeActivityInputSchema,
  posterDocumentSchema
} from "@/contracts/poster";
import { POST } from "@/app/api/templates/t01-preview/route";
import { findJob } from "@/server/job-store";

vi.mock("@/server/auth", () => ({
  requireApiIdentity: async () => ({ userId: "owner" }),
  forbiddenResponse: () => new Response("forbidden", { status: 403 }),
  unauthorizedResponse: () => new Response("unauthorized", { status: 401 })
}));
vi.mock("@/server/job-store", () => ({
  findJob: vi.fn(),
  updateJob: vi.fn()
}));

const input = employeeActivityInputSchema.parse({
  ...normal,
  activityName: "方案来源标题",
  slogan: "一起上场",
  subtitle: "零基础也能参加",
  includeQr: false,
  qrPayload: "",
  qrAssetId: ""
});
const optionDocument = posterDocumentSchema.parse({
  ...input,
  schemaVersion: "1.7",
  scene: "employee_activity",
  locale: "zh-CN",
  title: input.activityName,
  summary: "",
  immutableSource: {
    outputFormat: true,
    sessions: true,
    audience: true,
    contact: true,
    includeQr: true,
    ctaLabel: true,
    qrPayload: true,
    qrAssetId: true,
    notice: true
  }
});
const requestDocument = {
  ...optionDocument,
  title: "表单临时标题"
};
const optionId = "a0e2e33e-75ef-49d5-91b4-a46d6a12979e";
const assetPath = path.join(
  process.cwd(),
  "data",
  "generated",
  "preview-option-test.png"
);

beforeEach(async () => {
  vi.resetAllMocks();
  await mkdir(path.dirname(assetPath), { recursive: true });
  await writeFile(assetPath, Buffer.from("candidate-image"));
  vi.mocked(findJob).mockResolvedValue({
    id: "job",
    userId: "owner",
    visualOptions: [
      {
        id: optionId,
        assetPath,
        sourceDocument: optionDocument,
        readability: {
          contractVersion: "t01-readability-v1",
          backgroundMode: "input",
          logoVariant: "inverse",
          treatments: {
            hero: {
              treatment: "light_text_clean",
              textTone: "light",
              scrimStrength: 0,
              bounds: { x: 64, y: 64, width: 952, height: 1132 }
            }
          },
          initialAnalysis: [],
          finalAnalysis: [],
          passed: true
        }
      }
    ]
  } as never);
});

afterEach(async () => {
  await unlink(assetPath).catch(() => undefined);
});

describe("T01 selected visual live preview", () => {
  it("embeds the selected option and its source copy in the poster markup", async () => {
    const response = await POST(
      new Request("http://localhost/api/templates/t01-preview", {
        method: "POST",
        body: JSON.stringify({
          document: requestDocument,
          format: "portrait_1080x1920",
          jobId: "job",
          visualOptionId: optionId
        })
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { html: string };
    expect(payload.html).toContain(
      `data:image/png;base64,${Buffer.from("candidate-image").toString("base64")}`
    );
    expect(payload.html).toContain("方案来源标题");
    expect(payload.html).not.toContain("表单临时标题");
    expect(payload.html).toContain('data-text-tone="light"');
    expect(payload.html).toContain('data-logo-variant="inverse"');
  });
});
