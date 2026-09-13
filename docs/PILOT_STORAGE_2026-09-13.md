# 内部试用持久化与迁移

本轮为 10–30 人试用增加 PostgreSQL、私有 OSS、个人历史删除和生命周期清理。未配置 `DATABASE_URL` 时继续使用 `data/jobs.json`；`STORAGE_DRIVER=local` 时继续使用本地文件，便于开发和回归。

## 上线顺序

1. 创建 RDS PostgreSQL，限制网络白名单，并创建仅供应用使用的数据库账号。
2. 创建私有 OSS Bucket 和只允许该 Bucket 读写删的 RAM 账号。
3. 在 `/opt/ai-zhihui/shared/app.env` 添加 `DATABASE_URL`、`STORAGE_DRIVER=oss` 和 `OSS_*` 配置。
4. 发布新版本并运行 `npm run db:deploy`。
5. 先运行 `npm run storage:migrate` 查看只读清单；核对后运行 `npm run storage:migrate -- --apply`。
6. 以 3001 端口验证两个飞书账号的隔离、恢复、下载和删除，再切换 `current`。
7. 安装并启用 `ai-zhihui-storage-cleanup.service/.timer`。

Bucket 必须保持私有。浏览和下载继续经过应用接口的用户归属校验，不向前端保存永久 OSS URL。正式 PNG 长期保存；未选主视觉和预览 30 天后清理；用户删除的作品软删除 7 天后清理。

## 迁移与回退

迁移命令默认不写数据库或 OSS，只报告任务、用户、文件、字节数和缺失文件。`--apply` 按旧任务 ID 和幂等键写入；重复运行不会重复创建任务或对象。迁移仅携带当前选图、可导出成品及恢复所需数据，排除测试探针和无引用文件。

切流后保留 `/opt/ai-zhihui/shared/data` 只读一个发布周期。需要回退时将 `current` 指回旧 release，并恢复不含 `DATABASE_URL`、`STORAGE_DRIVER=local` 的旧环境配置；不要让新旧版本同时写同一份业务数据。

## 当前限制

Web 和生成逻辑仍在同一进程。服务重启会把处理中任务恢复为可重试状态并保留已成功上传的文件，但不会从中断点自动续跑。真实 RDS/OSS 连通性、RAM 权限和双飞书账号验收必须在阿里云资源准备完成后执行。
