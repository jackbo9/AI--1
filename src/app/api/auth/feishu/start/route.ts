import { NextResponse } from "next/server";
import { buildFeishuAuthorizationUrl } from "@/integrations/feishu/auth";
import {
  createOauthState,
  isFeishuAuthEnabled,
  oauthStateCookieName,
  sessionCookieOptions
} from "@/integrations/feishu/session";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  if (!isFeishuAuthEnabled()) {
    return NextResponse.redirect(
      new URL("/", serverEnv.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    );
  }

  try {
    const state = createOauthState();
    const response = NextResponse.redirect(
      buildFeishuAuthorizationUrl(state)
    );
    response.cookies.set(oauthStateCookieName, state, {
      ...sessionCookieOptions(10 * 60),
      maxAge: 10 * 60
    });
    return response;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "FEISHU_AUTH_NOT_CONFIGURED",
          message: "飞书登录尚未完成配置"
        }
      },
      { status: 503 }
    );
  }
}
