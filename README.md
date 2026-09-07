# 番仓 AniVault（0.12.3）

AGE 动漫自动追更下载器的本地桌面项目。面板用于维护追番配置、检查更新、执行下载、查看运行日志和管理待下载清单。

## 当前能力

- 读取、编辑并原子保存 `content.json`，保留未知字段并校验配置。
- 支持 dry-run、立即下载、停止运行、单实例锁和失败后续处理。
- MP4 支持 aria2、IDM、ffmpeg 链路；M3U8 固定使用 ffmpeg；支持并发、断点临时文件恢复和失败线路兜底。
- 自动维护 `downloaded_start`、`downloaded_end`、`site_latest`，缺失集可按 `auto_repair` 补下。
- 下载完成后按 `folder_name` / `file_name` 模板整理目录和文件；可选 mpv 观看同步。观看同步的达标条件是有效真实播放时长 45%，且最大播放位置 90%；关闭时如遇 Windows 短暂占用会限时重试改名。mpv 后台助手使用安装配置中的项目目录，切换 Git 分支前应确认目标分支已包含当前修复。
- 面板通过运行事件实时显示启动、每集状态、日志和结束结果，并以 7 秒低频快照校准异常或重载后的状态；清单支持永久跳过或仅删除当前行。
- 文件夹匹配、AGE 站点访问和下载链路已拆到 `src/folders.js`、`src/site.js`、`src/download.js`，`anime_updater.js` 保留主流程编排。
- `fetch_time` 可创建、更新或删除 `AniVaultAutoRun` 计划任务；旧任务链已退役，运行模式由入口明确指定。

## 安装与运行

环境：Windows、Node.js、pnpm、Microsoft Edge。aria2 与 ffmpeg 的本地运行文件放在 `tools/`，不进入 Git。

```powershell
Set-Location D:\project_codex\260814_animeinstall_auto
pnpm install --frozen-lockfile
pnpm run start
```

下载目录可在面板配置；环境变量 `AGE_DLOAD` 优先，未设置时默认使用 `D:\idm下载`。站点地址优先级为 `AGE_BASE`、`content.json` 的 `base_url`、默认 `https://www.agedm.io`。

## 测试与自检

```powershell
pnpm test
pnpm run smoke
pnpm run selftest
```

`pnpm test` 运行主流程、Node 测试和界面静态检查；`pnpm run smoke` 成功时输出 `SMOKE_OK`；`pnpm run selftest` 成功时输出 `SELFTEST_OK`。

## 目录入口

- `electron/`：Electron 主进程与 preload
- `renderer/`：桌面面板界面
- `src/`：文件夹、站点、下载等业务模块
- `scripts/`：自动运行与人工调试脚本
- `tests/`、`integrations/`：自动化测试和 mpv 模块
- `docs/`：项目架构与全景说明
- `使用说明.md`：详细配置、兼容方案、计划任务和历史版本说明
- `PROGRESS.md`、`BLOCKED.md`：运行记录与异常裁决记录

## 限制

- 当前仍以单站点 AGE 为目标，多站点扩展和安装包未包含。
- 下载、站点解析、路径和调度仍受本机 Edge、IDM、aria2、ffmpeg 路径与网络环境影响。
- 配置和运行记录使用 JSON、CSV 与文件锁，不具备数据库级并发事务。
- 部分界面数据通过低频校准读取日志，网络或进程异常时可能需要重新运行确认状态。

详细配置和历史行为请参阅 [使用说明.md](使用说明.md)。
