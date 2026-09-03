# 番仓 AniVault

## 定位

这是 AGE 动漫自动追更脚本的软件化桌面项目，当前版本为 `0.12.2`。核心入口是 `anime_updater.js`，桌面入口是 `electron/main.js`。旧任务链已退役，运行模式由入口明确指定。

## 常用命令

- `pnpm install --frozen-lockfile`：安装依赖
- `pnpm test`：运行 Node 测试
- `pnpm run start`：启动 Electron 面板
- `pnpm run smoke`：运行桌面 smoke 模式
- `pnpm run selftest`：运行桌面自检

## 约定

- `local/`、`tools/aria2/`、`tools/ffmpeg/ffmpeg.exe` 和 `node_modules/` 是本地运行产物，不提交。
- 修改行为、依赖、路径、调度或用户流程时，同步 `VERSION`、`package.json`、`README.md`、`使用说明.md`、`renderer/index.html` 的版本徽标和必要的 `BLOCKED.md`。
- 运行记录写入 `PROGRESS.md` 属于用户现场数据，未经确认不删除或回滚。
- 先运行 `pnpm test`、`git diff --check` 和 `git status --short --ignored`，再提交或发布。

## 当前边界

当前已覆盖配置面板、番剧启停、dry-run/下载控制、aria2/ffmpeg/IDM 链路、进度与清单，以及可选安装和启停的 mpv 观看同步。M3U8 固定走 ffmpeg，aria2 只处理单文件媒体。多站点扩展、安装包和更大范围重构仍在 `BLOCKED.md` 中，除非用户明确要求，不要擅自扩展。
