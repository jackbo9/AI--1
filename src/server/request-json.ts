export type JsonRequestBody =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

/**
 * Route handlers must not call Request.json() directly: an empty or malformed
 * client body otherwise throws before the handler can return the API's stable
 * JSON error envelope.
 */
export async function readJsonRequest(
  request: Request
): Promise<JsonRequestBody> {
  let text: string;

  try {
    text = await request.text();
  } catch {
    return { ok: false, message: "请求内容读取失败，请重试" };
  }

  if (!text.trim()) {
    return { ok: false, message: "请求内容不能为空" };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, message: "请求内容不是有效的 JSON" };
  }
}
