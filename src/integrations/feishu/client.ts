import "server-only";
import * as lark from "@larksuiteoapi/node-sdk";
import { serverEnv } from "@/lib/env";

let client: lark.Client | undefined;

export function getFeishuClient() {
  if (!serverEnv.FEISHU_APP_ID || !serverEnv.FEISHU_APP_SECRET) {
    throw new Error("飞书 App ID 或 App Secret 未配置");
  }
  client ??= new lark.Client({
    appId: serverEnv.FEISHU_APP_ID,
    appSecret: serverEnv.FEISHU_APP_SECRET,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu
  });
  return client;
}

export { lark };
