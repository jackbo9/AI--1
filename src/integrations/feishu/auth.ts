import "server-only";
import { serverEnv } from "@/lib/env";
import { getFeishuClient, lark } from "./client";

export function buildFeishuAuthorizationUrl(state: string) {
  if (!serverEnv.FEISHU_APP_ID || !serverEnv.FEISHU_REDIRECT_URI) {
    throw new Error("飞书登录地址未配置");
  }
  const url = new URL(
    "https://accounts.feishu.cn/open-apis/authen/v1/authorize"
  );
  url.searchParams.set("client_id", serverEnv.FEISHU_APP_ID);
  url.searchParams.set("redirect_uri", serverEnv.FEISHU_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (serverEnv.FEISHU_OAUTH_SCOPE) {
    url.searchParams.set("scope", serverEnv.FEISHU_OAUTH_SCOPE);
  }
  return url;
}

export async function exchangeFeishuCode(code: string) {
  if (!serverEnv.FEISHU_REDIRECT_URI) {
    throw new Error("飞书登录回调地址未配置");
  }
  const client = getFeishuClient();
  const token = await client.accessToken.retrieveByAuthorizationCode({
    code,
    redirectUri: serverEnv.FEISHU_REDIRECT_URI
  });
  const response = await client.authen.v1.userInfo.get(
    {},
    lark.withUserAccessToken(token.accessToken)
  );
  if (response.code && response.code !== 0) {
    throw new Error(`飞书用户信息获取失败（${response.code}）`);
  }
  const user = response.data;
  if (!user?.open_id || !user.tenant_key) {
    throw new Error("飞书未返回稳定用户标识");
  }
  return {
    openId: user.open_id,
    tenantKey: user.tenant_key,
    displayName: user.name?.trim() || "飞书用户"
  };
}
