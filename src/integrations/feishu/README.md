# 飞书 Phase 1 联调

当前网页在未配置飞书应用时以 `local-demo-user` 运行，便于演示受控生成闭环。真实联调前需要在 `.env.local` 填写 `FEISHU_APP_ID`、`FEISHU_APP_SECRET` 和 HTTPS 回调地址，并将工作台入口配置为应用根地址。

下一步待接入项：以飞书 OAuth 获取稳定 open_id 并映射内部 userId；使用 tenant_access_token 向创建者发送结果卡片。二者必须在真实 App ID、权限范围和测试域名确认后启用，不能使用姓名作为用户主键。
