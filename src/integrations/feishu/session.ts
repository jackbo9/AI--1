import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import {
  signSession,
  verifySession,
  type FeishuSession
} from "./session-token";

export const sessionCookieName = "admin_poster_session";
export const oauthStateCookieName = "admin_poster_oauth_state";
const sessionDurationSeconds = 8 * 60 * 60;

export type CurrentIdentity = {
  userId: string;
  displayName: string;
  provider: "local" | "feishu";
  openId?: string;
  tenantKey?: string;
};

export function isFeishuAuthEnabled() {
  return serverEnv.AUTH_MODE === "feishu";
}

export function createOauthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function createFeishuSession(input: {
  openId: string;
  tenantKey: string;
  displayName: string;
}) {
  const secret = requireSessionSecret();
  const payload: FeishuSession = {
    userId: `feishu:${input.tenantKey}:${input.openId}`,
    openId: input.openId,
    tenantKey: input.tenantKey,
    displayName: input.displayName,
    expiresAt: Date.now() + sessionDurationSeconds * 1000
  };
  return {
    value: signSession(payload, secret),
    maxAge: sessionDurationSeconds
  };
}

export async function getCurrentIdentity(): Promise<
  CurrentIdentity | undefined
> {
  if (!isFeishuAuthEnabled()) {
    return {
      userId: "local-demo-user",
      displayName: "本地演示",
      provider: "local"
    };
  }

  const value = (await cookies()).get(sessionCookieName)?.value;
  if (!value) return undefined;
  const session = verifySession(value, requireSessionSecret());
  if (!session) return undefined;
  return {
    userId: session.userId,
    displayName: session.displayName,
    provider: "feishu",
    openId: session.openId,
    tenantKey: session.tenantKey
  };
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: serverEnv.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge
  };
}

function requireSessionSecret() {
  if (!serverEnv.SESSION_SECRET || serverEnv.SESSION_SECRET.length < 32) {
    throw new Error("飞书登录模式需要至少 32 字符的 SESSION_SECRET");
  }
  return serverEnv.SESSION_SECRET;
}
