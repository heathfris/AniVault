# AniVault

Windows 本地动漫追更与下载管理面板。

AniVault 连接 AGE 站点、Edge 和本地下载工具，帮助用户维护追番清单、检查更新、下载缺失集，并查看运行状态。它是一个本地桌面应用，不需要云端账号，也不会把追番配置上传到第三方服务。

> 当前版本：`0.12.6` · Windows · AGE 单站点

## 普通用户

### 下载

前往 [GitHub Releases](../../releases) 下载最新的 `AniVault-*-portable.zip`，解压后双击 `AniVault.exe`。

Portable 包已经包含 Electron/Node.js、aria2 和 ffmpeg，普通用户不需要另外安装 Node.js、pnpm、aria2 或 ffmpeg。取址仍需要本机安装 Microsoft Edge。

首次启动会自动创建默认配置。配置、下载清单和运行记录保存在 Windows 用户数据目录，不写入程序包目录。

### 支持的能力

- 编辑和校验追番配置，保存时保留未知字段。
- dry-run、立即下载、停止运行、单实例锁和失败后续处理。
- MP4 使用 aria2、ffmpeg 或可选 IDM；M3U8 固定使用 ffmpeg。
- 并发下载、断点临时文件恢复、线路失败兜底和进度推进。
- 按模板整理目录与文件名，可选 mpv 观看同步。
- 实时显示启动、每集状态、日志、结束结果和待下载清单。
- 按 `fetch_time` 创建、更新或删除 Windows 计划任务 `AniVaultAutoRun`。

## 开发者

开发环境需要 Windows、Node.js、pnpm 和 Microsoft Edge。源码运行时，aria2 与 ffmpeg 放在本地 `tools/` 目录，不提交到 Git。

```powershell
pnpm install --frozen-lockfile
pnpm run start
```

下载目录可在面板中配置；环境变量 `AGE_DLOAD` 优先。站点地址优先级为 `AGE_BASE`、`content.json` 的 `base_url`、默认 `https://www.agedm.io`。

## 测试与打包

```powershell
pnpm test
pnpm run smoke
pnpm run selftest
pnpm package:portable
```

- `pnpm test`：主流程、Node 测试和界面静态检查。
- `pnpm run smoke`：桌面启动检查，成功输出 `SMOKE_OK`。
- `pnpm run selftest`：配置读写和运行器检查，成功输出 `SELFTEST_OK`。
- `pnpm package:portable`：生成 `dist/AniVault-<version>-portable/`，再压缩为 GitHub Release 附件。

## 项目结构

| 目录 | 作用 |
| --- | --- |
| `electron/` | Electron 主进程、preload 和 IPC |
| `renderer/` | 桌面面板界面 |
| `src/` | 配置、文件夹、站点、下载、调度等业务模块 |
| `scripts/` | Portable 打包、计划任务和调试入口 |
| `tests/` | 主流程、模块、UI 和 Portable 验收测试 |
| `integrations/` | mpv 观看同步模块 |
| `docs/` | 架构与设计记录 |

## 设计重点

- 主流程保留在 `anime_updater.js`，业务能力拆分到 `src/`，便于测试和后续替换下载链路。
- Electron 运行器通过事件推送状态，界面再用低频快照校准异常状态。
- Portable 模式将程序运行文件与用户数据分离，后续可以独立升级程序而保留配置和运行记录。
- `tools/`、`local/`、`content.json`、`PROGRESS.md` 和 `BLOCKED.md` 属于本地运行数据，不进入公开仓库。

## 当前限制

- 当前以 AGE 单站点和 Windows 为目标，不承诺多站点或跨平台支持。
- 站点解析依赖第三方页面结构和网络环境，可能随站点变化而失效。
- 取址依赖 Microsoft Edge；IDM 仅作为可选的交互式下载链路。
- 配置和运行记录使用 JSON、CSV 与文件锁，不具备数据库级并发事务。
- Portable 包目前没有代码签名、自动更新和完整安装器。

详细配置、计划任务、下载链路和 mpv 同步说明见 [使用说明.md](使用说明.md)。

## 参与开发

欢迎通过 Issue 报告可复现的问题或提出改进建议。提交代码前请运行 `pnpm test` 和 `git diff --check`，并避免提交个人配置、运行日志、下载记录和本地工具二进制。

## 许可证

本项目使用 [MIT License](LICENSE)。第三方站点、视频内容和外部工具的使用仍需遵守相应服务条款与适用法律。
