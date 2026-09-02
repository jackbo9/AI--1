import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));
const serverEnvSchema = z.object({ LLM_BASE_URL: optionalUrl, LLM_API_KEY: z.string().optional(), LLM_MODEL: z.string().optional(), IMAGE_BASE_URL: optionalUrl, IMAGE_API_KEY: z.string().optional(), IMAGE_MODEL: z.string().optional(), IMAGE_PROVIDER: z.enum(["seedream", ""]).optional(), FEISHU_APP_ID: z.string().optional(), FEISHU_APP_SECRET: z.string().optional(), NEXT_PUBLIC_APP_URL: optionalUrl });
export const serverEnv = serverEnvSchema.parse(process.env);
export const configured = { copy: Boolean(serverEnv.LLM_BASE_URL && serverEnv.LLM_API_KEY && serverEnv.LLM_MODEL), image: Boolean(serverEnv.IMAGE_PROVIDER === "seedream" && serverEnv.IMAGE_BASE_URL && serverEnv.IMAGE_API_KEY && serverEnv.IMAGE_MODEL), feishu: Boolean(serverEnv.FEISHU_APP_ID && serverEnv.FEISHU_APP_SECRET) };
