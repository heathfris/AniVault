# 番仓 AniVault（0.8.0）

AGE 动漫自动追更下载器的新桌面面板：查看/修改/保存配置，触发 dry-run 或下载、停止运行、看实时日志与待下载清单、打开下载目录。0.3.0 起下载引擎改为 aria2。

## 能做什么（当前范围）

- 全局设置与追番清单增删改查，保存前逐字段校验、原子写盘、未知字段保留
- 运行控制：Dry-run 检查更新 / 立即下载 / 停止，单实例锁防重复任务
- 下载引擎可切换：`defaults.download_engine`（aria2 / idm / ffmpeg，默认 aria2），面板下拉选择；MP4 所选引擎优先，失败按 aria2→ffmpeg→idm 兜底；M3U8 只用 ffmpeg/aria2（永不走 IDM）；IDM 仅面板交互模式生效
- 并发下载：`defaults.max_parallel`（默认 1，范围 1-10，推荐 3），缺失集按并发池下载
- 部分成功也推进进度：`downloaded_end` 更新为原 end 与本次成功/已存在集最高编号的较大值；失败集留待 `auto_repair` 自动补下
- 单次下载等待可配置：`defaults.attempt_timeout_min`（默认 20，范围 5-60，替代固定 45 分钟），只作用于等待文件稳定阶段
- 网络健壮性：请求 30 秒超时、`Connection: close`、fetch 失败自动重试 1 次（间隔 3 秒，超时不重试）；站点可由 `AGE_BASE` 覆盖（默认 https://www.agedm.io）；首页失败记 BLOCKED 后继续，单部番失败记 BLOCKED 后继续下一部，不再中断整个运行
- 清单保护：查询全部失败且本运行 0 行时保留上次待下载清单；有行才写新清单
- 清单剩余化：非 dry-run 结束后只保留失败/未完成集（成功与已存在集剔除），全部成功写空清单；dry-run 保留全部计划
- 每集下载状态：运行中实时显示每集 下载中/完成/失败，新一轮开始时清空
- 番剧卡片折叠：已有卡片默认收起（片名+删除+展开箭头），新增卡片默认展开
- 单部番启停：每部番可单独停用（`enabled: false`），停用后不查站、不补字段、不下载
- 每日自动运行：全局设置“每日抓取时间”`fetch_time`（HH:MM，留空关闭），保存后自动创建/更新/删除计划任务 `AniVaultAutoRun`（仅登录时运行，不碰旧任务 AGEAnimeUpdater）
- 手动跳过某集：清单行“删除”写入该番 `skip_eps`，之后运行不再列出；卡片展开区可查看/清空
- 清单汇总列：表格显示每部番“已下载/总数”（total = site_latest 或 downloaded_end，文件夹不可读时显示 ?）
- 站点地址可改：面板 `base_url`（留空 = 默认 https://www.agedm.io），优先级 AGE_BASE > base_url > 默认
- 启停显示：卡片头部只读显示“是否启用: 对/错”，勾选框仍可修改、保存/重载后刷新
- 界面排版：启停控件统一为「勾选框 + 开/关」整块可点、文字即时切换；全局设置两列、卡片头部对齐、日志与清单等高滚动、按钮统一 30px 与主次层级、焦点可见；截图自检 `pnpm run screenshot <path>`
- downloaded_start 自动规则：文件夹已有 ≥1 集 → 1，0 集 → 0（数不出集数时不改）
- 日志区只显示 PROGRESS 末尾（BLOCKED 仍照常写入文件）
- 实时日志（PROGRESS 末尾，上滚不拉回）、待下载清单表格、打开下载目录

暂不包含：站点选择、多站爬取、单部番启停开关、安装包（见 BLOCKED.md）。`auto_close_idm` 仅在本次有 IDM 成功下载时生效。

## 网络排查

agedm.io 偶发 fetch failed 时：

- 已内置：请求 30 秒超时、`Connection: close`、fetch 失败自动重试 1 次（间隔 3 秒）、失败记 BLOCKED 后继续运行
- 可尝试换 DNS：`119.29.29.29`（腾讯）或 `223.5.5.5`（阿里）
- 可用环境变量 `AGE_BASE` 覆盖站点地址（默认 `https://www.agedm.io`）

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

当前版本 0.8.0，版本记录见使用说明.md 文末。
