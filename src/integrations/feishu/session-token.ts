import crypto from "node:crypto";
import { z } from "zod";

const sessionPayloadSchema = z.object({
  userId: z.string().min(1),
  openId: z.string().min(1),
  tenantKey: z.string().min(1),
  displayName: z.string().min(1).max(120),
  expiresAt: z.number().int().positive()
});

export type FeishuSession = z.infer<typeof sessionPayloadSchema>;

export function signSession(payload: FeishuSession, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(
  value: string,
  secret: string,
  now = Date.now()
): FeishuSession | undefined {
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra) return undefined;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return undefined;
  }

  try {
    const parsed = sessionPayloadSchema.parse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown
    );
    return parsed.expiresAt > now ? parsed : undefined;
  } catch {
    return undefined;
  }
}
