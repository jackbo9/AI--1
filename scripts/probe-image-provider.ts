import path from "node:path";
import {
  illustrationBriefSchema
} from "../src/contracts/poster";
import { serverEnv } from "../src/lib/env";
import { generateIllustration } from "../src/providers/illustration-provider";
import { ProviderError } from "../src/providers/provider-error";

async function main() {
  if (process.env.ALLOW_PAID_MODEL_PROBE !== "1") {
    throw new ProviderError(
      "IMAGE_GENERATION_FAILED",
      "图片探针可能产生费用；请显式设置 ALLOW_PAID_MODEL_PROBE=1"
    );
  }

  const brief = illustrationBriefSchema.parse({
    subject: "几位企业同事",
    action: "在户外草坪进行轻松的手作互动",
    setting: "明亮、开阔、无任何文字标识的秋日活动空间",
    composition: "人物集中在中下方，上方保留大面积干净标题安全区",
    palette: "黑色、浅灰、行政黄与少量橙色",
    style: "现代简洁的企业活动插画",
    mood: "温暖、可信、自然",
    negative: "不要文字、字母、数字、Logo、二维码、水印、签名"
  });

  const startedAt = Date.now();
  const result = await generateIllustration(
    brief,
    `probe-${Date.now()}`
  );
  if (result.mode !== "generated") {
    throw new ProviderError(
      "IMAGE_GENERATION_FAILED",
      result.detail ?? "图片探针进入了默认资产降级"
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: result.provider,
        model: result.model,
        baseUrl: new URL(serverEnv.IMAGE_BASE_URL!).origin,
        elapsedMs: Date.now() - startedAt,
        output: path.basename(result.path)
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code:
          error instanceof ProviderError
            ? error.code
            : "IMAGE_PROBE_FAILED",
        message:
          error instanceof Error ? error.message : "图片模型探针失败"
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
