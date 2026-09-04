import { NextResponse } from "next/server";
import {
  sessionCookieName,
  sessionCookieOptions
} from "@/integrations/feishu/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    ...sessionCookieOptions(0),
    maxAge: 0
  });
  return response;
}
