import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { configured, serverEnv } from "@/lib/env";
import type { IllustrationBrief } from "@/contracts/poster";
import { t01CompositionContract } from "./prompt-compiler";
import {
  ProviderError,
  requestBytes,
  requestJson
} from "./provider-error";

export type IllustrationResult = {
  path: string;
  mode: "generated" | "fallback";
  provider: string;
  model: string;
  detail?: string;
};

const imageResponseSchema = z.object({
  data: z
    .array(
      z.object({
        url: z.string().url().optional(),
        b64_json: z.string().min(1).optional()
      })
    )
    .min(1)
});

export function seedreamPrompt(brief: IllustrationBrief) {
  const prompt = [
    "【画面主体】" + brief.subject,
    "【行为】" + brief.action,
    "【场景】" + brief.setting,
    "【用户创意构图】" + brief.composition,
    "【视觉风格】" + brief.style,
    "【色彩】" + brief.palette,
    "【氛围】" + brief.mood,
    "【禁止】" + brief.negative,
    "【版式构图】" + t01CompositionContract,
  ].join("\n");
  return illustrationPromptSchema.parse(prompt);
}

export const illustrationPromptSchema = z.string().trim().min(80).max(2200);

export async function generateIllustration(
  brief: IllustrationBrief,
  jobId: string
): Promise<IllustrationResult> {
  if (!configured.image) {
    return fallback(jobId, "demo-image", "未配置 Seedream，已使用默认品牌插画");
  }

  try {
    const payload = imageResponseSchema.parse(
      await requestJson(
        `${serverEnv.IMAGE_BASE_URL}/api/v3/images/generations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serverEnv.IMAGE_API_KEY}`
          },
          body: JSON.stringify({
            model: serverEnv.IMAGE_MODEL,
            prompt: seedreamPrompt(brief),
            size: serverEnv.IMAGE_SIZE,
            response_format: "url",
            watermark: false,
            sequential_image_generation: "disabled",
            n: 1
          })
        },
        {
          timeoutMs: 90_000,
          retries: 1,
          classify: classifyImageStatus,
          networkError: () =>
            new ProviderError(
              "IMAGE_GENERATION_FAILED",
              "主视觉生成服务暂时不可用",
              true
            )
        }
      )
    );

    const image = payload.data[0];
    const downloaded = image.url
      ? await requestBytes(image.url, {
          timeoutMs: 30_000,
          retries: 1
        })
      : undefined;
    const bytes = image.b64_json
      ? Buffer.from(image.b64_json, "base64")
      : downloaded?.bytes;

    if (!bytes || bytes.byteLength < 100) {
      throw new ProviderError(
        "IMAGE_DOWNLOAD_FAILED",
        "主视觉服务未返回有效图片"
      );
    }

    const imageFormat = detectImageFormat(bytes, downloaded?.contentType);
    const target = path.join(
      process.cwd(),
      "data",
      "generated",
      `${jobId}-illustration.${imageFormat.extension}`
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);

    return {
      path: target,
      mode: "generated",
      provider: "seedream",
      model: serverEnv.IMAGE_MODEL ?? "unknown"
    };
  } catch (error) {
    return fallback(
      jobId,
      "seedream",
      error instanceof ProviderError
        ? `${error.code}: ${error.message}`
        : "IMAGE_GENERATION_FAILED: 主视觉生成失败"
    );
  }
}

export function detectImageFormat(
  bytes: Buffer,
  contentType = ""
): { extension: "png" | "jpg" | "webp"; mimeType: string } {
  if (
    contentType.includes("image/png") ||
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return { extension: "png", mimeType: "image/png" };
  }
  if (
    contentType.includes("image/webp") ||
    (bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP")
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }
  if (
    contentType.includes("image/jpeg") ||
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
  ) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  throw new ProviderError(
    "IMAGE_DOWNLOAD_FAILED",
    "主视觉文件格式不受支持"
  );
}

function classifyImageStatus(status: number) {
  if (status === 401 || status === 403) {
    return new ProviderError(
      "IMAGE_AUTH_FAILED",
      "图片服务配置或权限无效",
      false,
      status
    );
  }
  if (status === 429) {
    return new ProviderError(
      "IMAGE_RATE_LIMITED",
      "图片服务繁忙",
      true,
      status
    );
  }
  return new ProviderError(
    "IMAGE_GENERATION_FAILED",
    "主视觉生成失败",
    status >= 500,
    status
  );
}

async function fallback(
  jobId: string,
  provider: string,
  detail: string
): Promise<IllustrationResult> {
  const target = path.join(
    process.cwd(),
    "data",
    "generated",
    `${jobId}-illustration.svg`
  );
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(
    path.join(
      process.cwd(),
      "public",
      "brand",
      "employee-activity-fallback.svg"
    ),
    target
  );
  return {
    path: target,
    mode: "fallback",
    provider,
    model: "brand-fallback-v2-minimal",
    detail
  };
}
