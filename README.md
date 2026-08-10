# AGE动漫自动追更下载器

每天 18 点，Windows 计划任务会叫醒 `anime_updater.js`。它先到 AGE动漫（agedm.io）把 `content.json` 里的追番清单过一遍，有新集就用无头 Edge 抓西瓜线路的视频直链，下载到 `D:\idm下载`，随后更新进度，并把文件夹名从 `1-5` 改成 `1-6`。

整套东西只依赖本机 Node.js、Edge、IDM 和 ffmpeg，不调用 AI，也不消耗 token。

## 现在能做什么

- 每天定时自动检查更新。任务名叫 `AGEAnimeUpdater`，时间写在 `content.json` 的 `fetch_time`，改了会自动同步
- 新集自动下载，下载完回写 `site_latest` 和 `downloaded_end`，同步改文件夹名
- 每次运行最多下载 10 集（`max_download`），老番补档不会被一次全量拉完
- 发现已记录集数缺失会自动补下（`auto_repair`）
- 全部下载结束后，IDM 空闲 60 秒自动关闭（`auto_close_idm`）
- 文件夹名和文件名支持模板，`{name}`、`{ep}`、`{end}`、`{start}` 可以自由组合
- `--dry-run` 只查更新、写待下载清单，不建文件夹、不改名

## 快速开始

前置条件有 Windows、Node.js、Edge、IDM 和 ffmpeg。项目会优先使用 `tools/ffmpeg/ffmpeg.exe`，也可以用 `AGE_FFMPEG` 指定其他位置。下载目录默认 `D:\idm下载`，可以用环境变量 `AGE_DLOAD` 改。

```powershell
# 先看今天有什么要下的
node anime_updater.js --dry-run

# 立即完整跑一遍
node anime_updater.js

# 创建或更新计划任务
node anime_updater.js --install-task
```

追番清单在 `content.json`。只写片名也能跑，脚本会自己搜索站内 id、补放送时间和已下载进度。详细配置和常见坑都在 [使用说明.md](使用说明.md)，改完配置先 dry-run 一次再实跑。

## 文件说明

## 下载通道

默认仍先尝试西瓜线路 1。交互模式下，MP4 直链交给 IDM，M3U8 播放列表交给 ffmpeg。密码后台计划任务统一使用 ffmpeg，避免 Windows 桌面会话隔离。待下载清单写入 `local/待下载清单.csv`，整个 `local/` 目录只保存在本机。

| 文件 | 作用 |
| --- | --- |
| `anime_updater.js` | 主程序，负责查更新、取直链、调 IDM、写进度、改名和同步计划任务 |
| `content.json` | 追番配置与进度记录，唯一事实来源 |
| `task_state.json` | 计划任务上次同步的时间和运行模式 |
| `PROGRESS.md` | 运行日志 |
| `BLOCKED.md` | 异常记录，比如搜不到片名、下载失败 |
| `local/待下载清单.csv` | 每次运行生成的缺失集清单，整个 `local/` 目录不进入 Git |

## 实际跑过的记录

2026-08-07 第一次实跑下载了两集。尼古喵喵第 6 集 546,699,157 字节，BanG Dream! YUME∞MITA 第 8 集 548,522,824 字节，都来自西瓜线路。下载完成后文件夹从 `1-5` 改到 `1-6`、`1-7` 改到 `1-8`，进度正确回写。

当前版本 1.4.0，清单里在追 5 部动漫。版本记录在 [使用说明.md](使用说明.md) 文末。
