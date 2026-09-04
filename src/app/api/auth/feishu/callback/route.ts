import { NextResponse } from "next/server";
import { exchangeFeishuCode } from "@/integrations/feishu/auth";
import {
  createFeishuSession,
  oauthStateCookieName,
  sessionCookieName,
  sessionCookieOptions
} from "@/integrations/feishu/session";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const expectedState = readCookie(cookieHeader, oauthStateCookieName);

  if (error || !code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json(
      {
        error: {
          code: "FEISHU_AUTH_CALLBACK_INVALID",
          message: error
            ? "飞书登录未获授权"
            : "飞书登录回调校验失败，请重新进入应用"
        }
      },
      { status: 400 }
    );
  }

  try {
    const identity = await exchangeFeishuCode(code);
    const session = createFeishuSession(identity);
    const response = NextResponse.redirect(
      new URL("/", serverEnv.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    );
    response.cookies.set(
      sessionCookieName,
      session.value,
      sessionCookieOptions(session.maxAge)
    );
    response.cookies.set(oauthStateCookieName, "", {
      ...sessionCookieOptions(0),
      maxAge: 0
    });
    return response;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "FEISHU_AUTH_EXCHANGE_FAILED",
          message: "飞书身份验证失败，请确认应用权限和回调地址"
        }
      },
      { status: 502 }
    );
  }
}

function readCookie(cookieHeader: string, name: string) {
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
