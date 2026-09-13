import { NextResponse } from "next/server";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
import { readJsonRequest } from "@/server/request-json";
import { suggestTitles, titleSuggestionInput } from "@/providers/title-suggestions";
import { ProviderError } from "@/providers/provider-error";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!await requireApiIdentity()) return unauthorizedResponse();
  const body = await readJsonRequest(request);
  const input = titleSuggestionInput.safeParse(body.ok ? body.value : undefined);
  if (!input.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: input.error.issues[0]?.message ?? "请填写一级大标题" } }, { status: 400 });
  try {
    return NextResponse.json(await suggestTitles(input.data.title));
  } catch (error) {
    return NextResponse.json({ error: { code: error instanceof ProviderError ? error.code : "LLM_REQUEST_FAILED", message: error instanceof ProviderError ? error.message : "文案建议生成失败，请重试" } }, { status: 502 });
  }
}
