# 番仓 AniVault（0.11.0）

AGE 动漫自动追更下载器的新桌面面板：查看/修改/保存配置，触发 dry-run 或下载、停止运行、看实时日志与待下载清单、打开下载目录。0.3.0 起下载引擎改为 aria2。

## 能做什么（当前范围）

- 全局设置与追番清单增删改查，保存前逐字段校验、原子写盘、未知字段保留
- 下载目录可在面板“下载目录（AGE_DLOAD）”中配置，环境变量 `AGE_DLOAD` 存在时优先；留空使用 `D:\\idm下载`
- 运行控制：Dry-run 检查更新 / 立即下载 / 停止，单实例锁防重复任务
- 下载引擎可切换：`defaults.download_engine`（aria2 / idm / ffmpeg，默认 aria2），面板下拉选择；MP4 所选引擎优先并按可用链路兜底；M3U8 固定使用 ffmpeg，避免调用不支持 HLS 的 aria2；IDM 仅面板交互模式生效
- 并发下载：`defaults.max_parallel`（默认 1，范围 1-10，推荐 3），缺失集按并发池下载
- 部分成功也推进进度：`downloaded_end` 更新为原 end 与本次成功/已存在集最高编号的较大值；失败集留待 `auto_repair` 自动补下
- 下载完成改名遇到 Windows 临时占用时自动重试；再次运行会从 `.part.mp4` 中复用时长完整的候选，明显短于上一集的残缺视频不会推进进度
- 单次下载等待可配置：`defaults.attempt_timeout_min`（默认 20，范围 5-60，替代固定 45 分钟），只作用于等待文件稳定阶段
- 网络健壮性：请求 30 秒超时、`Connection: close`、fetch 失败自动重试 1 次（间隔 3 秒，超时不重试）；站点可由 `AGE_BASE` 覆盖（默认 https://www.agedm.io）；首页失败记 BLOCKED 后继续，单部番失败记 BLOCKED 后继续下一部，不再中断整个运行
- 清单保护：查询全部失败且本运行 0 行时保留上次待下载清单；有行才写新清单
- 清单剩余化：非 dry-run 结束后只保留失败/未完成集（成功与已存在集剔除），全部成功写空清单；dry-run 保留全部计划
- 每集下载状态：运行中实时显示每集 下载中/完成/失败，新一轮开始时清空
- 番剧卡片折叠：已有卡片默认收起（片名+删除+展开箭头），新增卡片默认展开
- 单部番启停：每部番可单独停用（`enabled: false`），停用后不查站、不补字段、不下载
- 每日自动运行：全局设置“每日抓取时间”`fetch_time`（HH:MM，留空关闭），保存后自动创建/更新/删除计划任务 `AniVaultAutoRun`；任务仅登录时运行，通过 `wscript.exe` 调用 `scripts/auto-run.vbs`，不会弹出命令行窗口或 Windows Terminal 标签；不碰旧任务 `AGEAnimeUpdater`
- 待下载清单操作：“跳过此集”写入该番 `skip_eps`，以后不再列出；“删除”只移除当前清单行，下次检查仍可重新出现
- 清单汇总列：表格显示每部番“已下载/总数”（total = site_latest 或 downloaded_end，文件夹不可读时显示 ?）
- 站点地址可改：面板 `base_url`（留空 = 默认 https://www.agedm.io），优先级 AGE_BASE > base_url > 默认
- 启停显示：卡片头部只读显示“是否启用: 对/错”，勾选框仍可修改、保存/重载后刷新
- 界面排版：启停控件统一为「勾选框 + 开/关」整块可点、文字即时切换；全局设置两列、卡片头部对齐、日志与清单等高滚动、按钮统一 30px 与主次层级、焦点可见；截图自检 `pnpm run screenshot <path>`
- 滚动修复：日志区与清单区固定 320px 高、内容超出各自内部滚动、两栏等高（0.8.1）
- 表单与列表标准化（0.8.2）：全局设置左标签右控件垂直单列、所有 input/select 统一样式、数字类定宽、hint 置控件下方；列表行 = 箭头+名称输入+开/关+「编辑」+「删除」（危险色），hover 浅底色，空状态提示；≤1000px 自动单列；新增 `tests/ui-check.js` 防回归
- 性能优化（0.9.0）：无头 Edge 浏览器一次运行只启动一个实例（取址并发各自独立 context）；PROGRESS/BLOCKED 日志超 2000 行自动轮转保留尾部；面板日志只读文件末尾；站点地址（getBase）按文件缓存。连接头 `Connection: close` 与 aria2 `-x16` 保持现状（防 fetch failed 与限流，后续再调）
- 无窗口自动运行（0.9.1）：`AniVaultAutoRun` 改由 `wscript.exe` 调用 `scripts/auto-run.vbs`，隐藏启动 Electron Node 模式并传递退出码；`scripts/auto-run.cmd` 保留用于手动调试
- 目录迁移适配（0.9.2）：项目当前目录为 `D:\project_codex\260814_animeinstall_auto`；两个启动脚本均从自身位置解析项目根目录。目录再次改名后，需重新安装依赖并在面板保存一次配置，以刷新计划任务中的绝对路径
- 维护修复（0.9.3）：界面版本徽标与 `VERSION` 同步；`pnpm test` 统一运行主流程、Node test runner 和 UI 检查；截图命令内置当前 Windows 环境所需的 Chromium Viz 兼容参数
- 首页时间校验（0.9.4）：只接受严格的 `HH:MM`，不再把 `2026` 等年份误写入番剧的 `update_time`
- mpv观看同步（0.10.0）：面板可选安装、检查、启停、更新和卸载内置mpv模块；`folder_name`加入一个`{watched}`后，正常关闭mpv时按“真实播放时长90%且最大播放位置90%”更新观看前缀。安装后默认停用，不覆盖外部修改的部署文件
- 下载链路校正（0.10.2）：M3U8 直接使用 ffmpeg，不再先调用本机 aria2 的无效 HLS 参数；`pnpm test` 只发现仓库测试，不误跑 `local/` 第三方文件；同步校正版本、安装状态和文档。
- 清单操作与中文标签（0.11.0）：待下载行区分永久“跳过此集”和仅影响当前CSV的“删除”；番剧详情字段改用中文标签，内部配置键保持不变。
- downloaded_start 自动规则：文件夹已有 ≥1 集 → 1，0 集 → 0（数不出集数时不改）
- 日志区只显示 PROGRESS 末尾（BLOCKED 仍照常写入文件）
- 实时日志（PROGRESS 末尾，上滚不拉回）、待下载清单表格、打开下载目录

暂不包含：站点选择、多站爬取、安装包（见 BLOCKED.md）。`auto_close_idm` 仅在本次有 IDM 成功下载时生效。

## 网络排查

agedm.io 偶发 fetch failed 时：

- 已内置：请求 30 秒超时、`Connection: close`、fetch 失败自动重试 1 次（间隔 3 秒）、失败记 BLOCKED 后继续运行
- 可尝试换 DNS：`119.29.29.29`（腾讯）或 `223.5.5.5`（阿里）
- 可用环境变量 `AGE_BASE` 覆盖站点地址（默认 `https://www.agedm.io`）

## 环境

- Windows；Node.js 与 pnpm（本机不在系统 PATH，运行前先把自带运行时加进 PATH）
- aria2 已随项目放在 `tools/aria2/aria2c.exe`（不进入 git），用于单文件媒体；ffmpeg 在 `tools/ffmpeg/`，负责 M3U8 并作为 MP4 兜底

## 安装与运行

```powershell
Set-Location D:\project_codex\260814_animeinstall_auto
pnpm install --frozen-lockfile
pnpm run start
```

## 自检

```powershell
pnpm test           # 主流程测试 + 全部 *.test.js + UI 静态检查
pnpm run smoke      # 打开窗口，加载成功打印 SMOKE_OK 并退出 0
pnpm run selftest   # 配置临时副本读写 + 假脚本运行端到端，打印 SELFTEST_OK
```

当前版本 0.11.0，版本记录见使用说明.md 文末。mpv模块源码和专项说明见 `integrations/mpv-watched-prefix/`。2026-09-01 本机核验：模块已安装到 `F:\Backend\mpv.lite`、处于启用状态且部署哈希匹配；换电脑或换目录时仍应以面板“检查状态”为准。
