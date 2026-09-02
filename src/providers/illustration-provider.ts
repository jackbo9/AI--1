import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { configured, serverEnv } from "@/lib/env";
import type { IllustrationBrief } from "@/contracts/poster";
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
  return [
    brief.subject,
    brief.action,
    brief.setting,
    brief.composition,
    `配色：${brief.palette}`,
    `风格：${brief.style}`,
    `氛围：${brief.mood}`,
    brief.negative
  ].join("。") + "。";
}

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
            size: "2K",
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
  await writeFile(target, fallbackSvg);
  return {
    path: target,
    mode: "fallback",
    provider,
    model: "brand-fallback-v1",
    detail
  };
}

const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 540"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#dbe9ff"/><stop offset="1" stop-color="#a8c7ff"/></linearGradient></defs><rect width="700" height="540" rx="48" fill="url(#g)"/><circle cx="560" cy="110" r="90" fill="#fff4bd"/><path d="M0 415 Q130 330 260 430 T700 370V540H0Z" fill="#5f8ff8" opacity=".5"/><path d="M80 430c42-120 85-120 127 0" fill="none" stroke="#244c9d" stroke-width="20" stroke-linecap="round"/><circle cx="350" cy="265" r="48" fill="#ffbd87"/><path d="M275 410c12-85 45-124 75-124s63 39 75 124" fill="#2b5bd7"/><path d="M315 210c16-58 79-69 108-9" fill="#233765"/><circle cx="495" cy="310" r="38" fill="#ffbd87"/><path d="M430 430c10-75 38-108 65-108s55 33 65 108" fill="#ff8b66"/><path d="M465 267c13-45 61-53 82-8" fill="#34436c"/></svg>`;
