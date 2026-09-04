# 飞书局域网联调

当前联调模式：

```text
飞书工作台
  -> http://10.6.4.183:3000
  -> 飞书 OAuth
  -> 签名 HttpOnly Session
  -> 当前员工活动 Demo
```

## 飞书后台配置

在企业自建应用中开启网页应用，并配置：

```text
桌面端主页：
http://10.6.4.183:3000

移动端主页：
http://10.6.4.183:3000

重定向 URL：
http://10.6.4.183:3000/api/auth/feishu/callback

H5 可信域名：
http://10.6.4.183:3000
```

将应用可用范围限制在测试人员，并创建测试版本。

首版登录只读取飞书登录后返回的基础用户标识和显示名称，不申请完整通讯录权限，不以姓名作为业务主键。

## 本机配置

`.env.local`：

```env
AUTH_MODE=feishu
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_REDIRECT_URI=http://10.6.4.183:3000/api/auth/feishu/callback
SESSION_SECRET=至少32字符的随机值
NEXT_PUBLIC_APP_URL=http://10.6.4.183:3000
```

启动：

```bash
npm run dev
```

同一局域网内访问：

```text
http://10.6.4.183:3000
```

## 安全边界

- App Secret、模型密钥和 Session Secret 只存在服务端。
- OAuth 回调校验一次性 `state`，防止登录 CSRF。
- Session Cookie 为 HttpOnly、SameSite=Lax。
- 局域网 HTTP 模式下 Cookie 无法启用 Secure；迁移到 HTTPS 后会自动启用。
- 任务查询、文案确认、只换主视觉和 PNG 下载均校验任务所有者。
- 登录回调不保存 user_access_token。

## 当前未接入

- 机器人完成通知。
- 飞书事件订阅。
- 卡片动作回调。
- 多维表格同步。

这些能力不影响工作台入口、身份识别和网页生成闭环。
