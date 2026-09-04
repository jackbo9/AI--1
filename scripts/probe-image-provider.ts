import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  illustrationBriefSchema,
  type PosterDocument
} from "../src/contracts/poster";
import { serverEnv } from "../src/lib/env";
import {
  generateIllustration
} from "../src/providers/illustration-provider";
import { ProviderError } from "../src/providers/provider-error";
import {
  t01CompositionContract,
  t01VisualStyleContract
} from "../src/providers/prompt-compiler";
import { renderEmployeeActivity } from "../src/templates/employee-activity";

type ImageDimensions = {
  width: number;
  height: number;
};

const probeDocument: PosterDocument = {
  schemaVersion: "1.7",
  scene: "employee_activity",
  locale: "zh-CN",
  outputFormat: "portrait_1080x1920",
  category: "team",
  title: "秋日同行日",
  subtitle: "和同事一起，在自然光下完成轻松的手作互动。",
  summary: "一场为同事准备的轻松秋日相聚。",
  sessions: [
    {
      label: "上海站",
      date: "2026-09-18",
      time: "14:00–17:30",
      location: "总部多功能厅",
      details: []
    }
  ],
  audience: "全体员工",
  highlights: ["轻松互动"],
  participationSteps: ["点击活动链接完成报名"],
  notice: "活动名额有限，请以现场安排为准。",
  includeQr: false,
  ctaLabel: "",
  qrPayload: "",
  contact: "",
  immutableSource: {
    outputFormat: true,
    sessions: true,
    audience: true,
    contact: true,
    includeQr: true,
    ctaLabel: true,
    qrPayload: true,
    notice: true
  }
};

async function main() {
  if (process.env.ALLOW_PAID_MODEL_PROBE !== "1") {
    throw new ProviderError(
      "IMAGE_GENERATION_FAILED",
      "图片探针可能产生费用；请显式设置 ALLOW_PAID_MODEL_PROBE=1"
    );
  }

  const brief = illustrationBriefSchema.parse({
    subject: "三位企业同事",
    action: "在秋日草坪边共同完成一项轻松的手作互动",
    setting: "现代企业园区的开阔户外空间，背景干净且无任何文字标识",
    composition: t01CompositionContract,
    palette: "黑白灰基底、浅色自然光与少量行政黄",
    style: t01VisualStyleContract,
    mood: "克制、温暖、可信、自然",
    negative: "不要文字、字母、数字、Logo、二维码、水印、签名"
  });
  const probeId = `probe-t01-${Date.now()}`;
  const startedAt = Date.now();
  const illustration = await generateIllustration(brief, probeId);

  if (illustration.mode !== "generated") {
    throw new ProviderError(
      "IMAGE_GENERATION_FAILED",
      illustration.detail ?? "图片探针进入了默认资产降级"
    );
  }

  const [imageBytes, rendered] = await Promise.all([
    readFile(illustration.path),
    renderEmployeeActivity(probeDocument, illustration.path, probeId)
  ]);
  const dimensions = imageDimensions(imageBytes);
  const treatments = Object.fromEntries(
    Object.entries(rendered.readability.treatments).map(
      ([region, treatment]) => [
        region,
        `${treatment.treatment}@${treatment.scrimStrength}`
      ]
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: illustration.provider,
        model: illustration.model,
        baseUrl: new URL(serverEnv.IMAGE_BASE_URL!).origin,
        elapsedMs: Date.now() - startedAt,
        requestedOutput: "2K (当前集成参数)",
        sourceImage: path.basename(illustration.path),
        sourceDimensions: dimensions,
        sourceAspectRatio: Number(
          (dimensions.width / dimensions.height).toFixed(4)
        ),
        poster: path.basename(rendered.outputPath),
        backgroundMode: rendered.readability.backgroundMode,
        fallbackReason: rendered.readability.fallbackReason ?? null,
        treatments
      },
      null,
      2
    )
  );
}

function imageDimensions(bytes: Buffer): ImageDimensions {
  if (
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (
        marker >= 0xc0 &&
        marker <= 0xc3 &&
        offset + 9 < bytes.length
      ) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7)
        };
      }
      offset += 2 + length;
    }
  }

  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP" &&
    bytes.subarray(12, 16).toString("ascii") === "VP8X"
  ) {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    };
  }

  throw new ProviderError(
    "IMAGE_DOWNLOAD_FAILED",
    "探针图片格式无法读取尺寸"
  );
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code:
          error instanceof ProviderError
            ? error.code
            : "IMAGE_PROBE_FAILED",
        message:
          error instanceof Error ? error.message : "图片探针失败"
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
