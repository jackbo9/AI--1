# 阿里云 Demo 部署记录

更新：2026-09-04。云端服务已启动，飞书后台切换及真实用户端到端验收仍待完成。

## 当前环境

- ECS：杭州，`47.114.33.166`，Ubuntu 24.04，2 vCPU / 4 GiB / 40 GiB。
- Node.js：22.23.2。网站入口：`https://47.114.33.166`。
- 源码目录：`/opt/ai-zhihui/releases/20260904`，`current` 符号链接指向该版本。
- 源码上传时的内容与本地 `915c331` 一致，另包含本轮 package.json / lockfile 安全更新。
- 运行账户：`poster`。Web 与异步任务仍是一个 Next.js 进程，不能启动多副本共享 JSON。
- `data` 链接到 `/opt/ai-zhihui/shared/data`；本机历史任务未迁移。
- 环境变量：`/opt/ai-zhihui/shared/app.env`，权限 root:poster 0640。不得提交或打印其内容。
- 浏览器：Playwright 1.55.1 / Chromium Headless Shell 1193，安装于 `shared/browser`。
- systemd：`ai-zhihui.service`，开机启动、失败重启。应用仅监听 `127.0.0.1:3000`。
- Nginx：公网 80 仅用于 ACME 和 HTTPS 跳转；443 反向代理应用。未登录 API 返回 AUTH_REQUIRED。
- Let's Encrypt IP 短期证书已签发；`ai-cert-renew.timer` 每日两次检查续期。模拟续期成功。
- ECS 费用仍取决于账户试用期限/额度；证书免费，已有模型调用另计。不代表永久免费。

## 飞书配置

桌面端和移动端主页：`https://47.114.33.166`。

新增重定向 URL：`https://47.114.33.166/api/auth/feishu/callback`。

保留原局域网回调用于回退。应用可用范围应包含试用同事；按飞书后台要求发布配置。
当前未使用前端 JSAPI；如果后续接入，应另行核验 H5 可信域名要求。

## 已验证

- 云服务器上 TypeScript、ESLint、72 个单元/接口测试、生产构建通过。
- 初次部署首页曾被构建为 local 身份的静态页面。已改为 force-dynamic，要求每次请求按运行时环境和会话校验身份；顶部身份文案也改为读取 provider。修复后应验证未登录首页 307 跳转，不再以首页 200 作为验收。
- 未登录创建任务被拒绝；登录入口跳转 accounts.feishu.cn，回调指向云端 HTTPS，state Cookie 含 Secure/HttpOnly。
- 竖版固定 Fixture 可输出 PNG；横版 1920×1080、Banner 2227×950、长图 1080×3024 输出成功。
- 空长图 1920，高文本样例 4189；标题溢出被阻断。
- 已知安全问题对应的 Playwright、PostCSS、Sharp、Vitest 已更新；更新后完整 npm 审计接口多次超时，不宣称完整审计为零。

## 待验收与限制

- 飞书后台配置、真实用户登录及新建任务/生图/下载，以及第二用户隔离待验证。
- 竖版逐字节重复 PNG 检查在 Linux 的 `light-title-dark-copy` 样例失败两次。首组对比仅 20 个像素不同，位于文本区域（328,1408）—（680,1428）；未放宽或删除断言。不能宣称全部视觉回归通过。
- 长图像素对比度未采样，沿用项目既有限制。
- JSON 和本地图片仍是 Demo 存储；进程中断的任务不具有持久队列恢复保证。
- 数据虽跨应用版本持久保存，但尚未配置异机备份；实例释放或磁盘损坏仍会丢失。
- 杭州公网接入的备案/企业要求需结合实际使用方式确认，IP HTTPS 不是免备案承诺。
- 临时部署公钥在最终联调完成后移除，只移除注释为 `ai-zhihui-ecs-deploy-20260904` 的行，不影响其他密钥。

## 运维

```bash
systemctl status ai-zhihui nginx ai-cert-renew.timer
systemctl restart ai-zhihui
systemctl list-timers ai-cert-renew.timer
/opt/certbot/bin/certbot renew --dry-run
```

后续发布：建立新 release，安装锁定依赖并构建，链接相同 shared/data，验证后切换 current 并重启单个服务。
回退时指回保留的旧 release；不得覆盖 shared 数据。本次是第一份云端版本，当前没有旧云端版本可回退。
