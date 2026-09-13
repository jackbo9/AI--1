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
  IMAGE_PROVIDER: z.enum(["seedream", "openai-images", ""]).optional(),
  IMAGE_BASE_URL: optionalUrl,
  IMAGE_API_KEY: z.string().optional(),
  IMAGE_MODEL: z.string().optional(),
  IMAGE_SIZE: imageSize,
  VISUAL_STYLE_MODE: z.enum(["editorial", "legacy"]).default("editorial"),
  READABILITY_MODE: z.enum(["strict", "trial"]).default("strict"),
  FEISHU_APP_ID: z.string().optional(),
  FEISHU_APP_SECRET: z.string().optional(),
  FEISHU_REDIRECT_URI: optionalUrl,
  FEISHU_OAUTH_SCOPE: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: optionalUrl,
  DATABASE_URL: z.string().url().optional().or(z.literal("")),
  STORAGE_DRIVER: z.enum(["local", "oss"]).default("local"),
  OSS_REGION: z.string().optional(),
  OSS_ENDPOINT: optionalUrl,
  OSS_BUCKET: z.string().optional(),
  OSS_ACCESS_KEY_ID: z.string().optional(),
  OSS_ACCESS_KEY_SECRET: z.string().optional(),
  OSS_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300)
});

export const serverEnv = serverEnvSchema.parse(process.env);

export const configured = {
  database: Boolean(serverEnv.DATABASE_URL),
  objectStorage: serverEnv.STORAGE_DRIVER === "oss",
  copy: Boolean(
    serverEnv.LLM_PROVIDER === "deepseek" &&
      serverEnv.LLM_BASE_URL &&
      serverEnv.LLM_API_KEY &&
      serverEnv.LLM_MODEL
  ),
  image: Boolean(
    (serverEnv.IMAGE_PROVIDER === "seedream" ||
      serverEnv.IMAGE_PROVIDER === "openai-images") &&
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
