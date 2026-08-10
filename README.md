# 番仓 AniVault（Demo 0.3.0）

AGE 动漫自动追更下载器的新桌面面板：查看/修改/保存配置，触发 dry-run 或下载、停止运行、看实时日志与待下载清单、打开下载目录。0.3.0 起下载引擎改为 aria2。

## 能做什么（当前范围）

- 全局设置与追番清单增删改查，保存前逐字段校验、原子写盘、未知字段保留
- 运行控制：Dry-run 检查更新 / 立即下载 / 停止，单实例锁防重复任务
- 下载引擎：MP4 与 M3U8 默认 aria2（`tools/aria2/aria2c.exe`），缺失或失败回退 ffmpeg；IDM 不再参与主流程（函数保留）
- 并发下载：`defaults.max_parallel`（默认 1，范围 1-10，推荐 3），缺失集按并发池下载
- 网络健壮性：请求 30 秒超时；首页失败记 BLOCKED 后继续，单部番失败记 BLOCKED 后继续下一部，不再中断整个运行
- 实时日志（本次运行输出 + PROGRESS 末尾，上滚不拉回）、待下载清单表格、打开下载目录

暂不包含：站点选择、多站爬取、单部番启停开关、安装包（见 BLOCKED.md）。`auto_close_idm` 配置暂不生效。

## 环境

- Windows；Node.js 与 pnpm（本机不在系统 PATH，运行前先把自带运行时加进 PATH）
- aria2 已随项目放在 `tools/aria2/aria2c.exe`（不进入 git）；ffmpeg 在 `tools/ffmpeg/` 作兜底

## 安装与运行

```powershell
$env:PATH = "C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;$env:PATH"
pnpm install
pnpm run start
```

## 自检

```powershell
pnpm run smoke      # 打开窗口，加载成功打印 SMOKE_OK 并退出 0
pnpm run selftest   # 配置临时副本读写 + 假脚本运行端到端，打印 SELFTEST_OK
node tests/run-tests.js
node tests/validator.test.js
node tests/runner.test.js
node tests/csv.test.js
node tests/resilience.test.js
```

当前版本 0.3.0，版本记录见使用说明.md 文末。
