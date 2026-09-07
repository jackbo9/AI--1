import { describe, expect, it } from "vitest";
import {
  imageGenerationEndpoint,
  imageGenerationPayload
} from "@/providers/illustration-provider";

describe("illustration provider adapters", () => {
  const prompt =
    "【已确认画面方案】保留这一段确认内容，不允许图片供应商适配器改写。" +
    "【版式构图】左上留白，主体位于中右区域。" +
    "【系统强制禁止】不要文字、Logo、二维码或水印。";

  it("keeps the existing Seedream request contract", () => {
    expect(
      imageGenerationEndpoint("seedream", "https://ark.example.com/")
    ).toBe("https://ark.example.com/api/v3/images/generations");
    expect(
      imageGenerationPayload("seedream", {
        model: "seedream-model",
        prompt,
        size: "2K"
      })
    ).toEqual({
      model: "seedream-model",
      prompt,
      size: "2K",
      response_format: "url",
      watermark: false,
      sequential_image_generation: "disabled",
      n: 1
    });
  });

  it("maps the same prompt to the OpenAI Images compatible request", () => {
    expect(
      imageGenerationEndpoint(
        "openai-images",
        "https://ai.zjsinnet-cloud.com"
      )
    ).toBe("https://ai.zjsinnet-cloud.com/v1/images/generations");
    expect(
      imageGenerationEndpoint(
        "openai-images",
        "https://ai.zjsinnet-cloud.com/v1/"
      )
    ).toBe("https://ai.zjsinnet-cloud.com/v1/images/generations");

    const payload = imageGenerationPayload("openai-images", {
      model: "gpt-image-2",
      prompt,
      size: "1024x1792"
    });
    expect(payload).toEqual({
      model: "gpt-image-2",
      prompt,
      size: "1024x1792",
      quality: "medium",
      output_format: "png",
      n: 1
    });
    expect(payload.prompt).toBe(prompt);
    expect(payload).not.toHaveProperty("watermark");
    expect(payload).not.toHaveProperty("sequential_image_generation");
    expect(payload).not.toHaveProperty("response_format");
  });
});
