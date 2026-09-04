import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));
const imageSize = z
  .string()
  .regex(
    /^(?:[1-9]\d{2,4}x[1-9]\d{2,4}|[1-9]\d?K)$/,
    "IMAGE_SIZE 必须为分辨率档位（如 2K）或宽x高（如 1600x2848）"
  )
  .default("2K");

const serverEnvSchema = z.object({
  AUTH_MODE: z.enum(["local", "feishu"]).default("local"),
  LLM_PROVIDER: z.enum(["deepseek", ""]).optional(),
  LLM_BASE_URL: optionalUrl,
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  IMAGE_PROVIDER: z.enum(["seedream", ""]).optional(),
  IMAGE_BASE_URL: optionalUrl,
  IMAGE_API_KEY: z.string().optional(),
  IMAGE_MODEL: z.string().optional(),
  IMAGE_SIZE: imageSize,
  FEISHU_APP_ID: z.string().optional(),
  FEISHU_APP_SECRET: z.string().optional(),
  FEISHU_REDIRECT_URI: optionalUrl,
  FEISHU_OAUTH_SCOPE: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: optionalUrl
});

export const serverEnv = serverEnvSchema.parse(process.env);

export const configured = {
  copy: Boolean(
    serverEnv.LLM_PROVIDER === "deepseek" &&
      serverEnv.LLM_BASE_URL &&
      serverEnv.LLM_API_KEY &&
      serverEnv.LLM_MODEL
  ),
  image: Boolean(
    serverEnv.IMAGE_PROVIDER === "seedream" &&
      serverEnv.IMAGE_BASE_URL &&
      serverEnv.IMAGE_API_KEY &&
      serverEnv.IMAGE_MODEL
  ),
  feishu: Boolean(
    serverEnv.FEISHU_APP_ID &&
      serverEnv.FEISHU_APP_SECRET &&
      serverEnv.FEISHU_REDIRECT_URI &&
      serverEnv.SESSION_SECRET
  )
};
