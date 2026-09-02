# BLOCKED

当前无开发阻塞。运行态仍需由下一次真实下载确认 `.part.mp4` 恢复与有限重试能消除现场 EPERM；mpv 已有真实长视频观看采样，但仍缺按现役“45%时长+90%位置”规则成功改名的端到端记录。以下内容是历史裁决与运行异常记录，不代表当前待办；仍未纳入当前范围的事项只有多站点、安装包和未获授权的重构。

2026-09-01 状态更新：0.4.0 时保留的“M3U8 先走 aria2”已在 0.10.2 纠正为直接使用 ffmpeg，因为本机 aria2 1.37.0 多次明确报 `unknown option -- hls-segment-threads=16`。以下旧裁决保留作历史证据。

## 番仓 AniVault 0.9.0 待裁决/范围外（2026-08-11）
- content.json 的现有 enabled 改动（用户停用两部番）按拍板随本件提交，未额外修改。
- 纯 `pnpm run screenshot` 在本环境可能报 UnknownVizError（0.8.1 已记录），截图必要时用 `--in-process-gpu --disable-features=CalculateNativeWinOcclusion` + 独立 user-data-dir 执行同一 --screenshot 模式。
- 单部番启停之外的多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.8.1 待裁决/范围外（2026-08-11）
- 任务 0 时 content.json 已有未提交改动（面板停用《幼女战记 第二季》与《擅长逃跑的殿下 第二季》，enabled=false）：本件白名单不含 content.json，不覆盖、不提交，留待用户裁决。
- 本件只动 renderer/styles.css 的 .run-columns/.log/.csv-scroll 规则与版本/文档；其余文件一律不碰。

## 番仓 AniVault 0.8.0 待裁决/范围外（2026-08-11）
- 截图自检产物只存 local/screenshots/（已被 gitignore 忽略），不进入版本库；before.png 与 v0.8.0.png 用于人工视觉对比。
- UI 改动不触碰任何测试文件与业务逻辑；元素 id（f-enabled/f-title/f-*、csv-table、log-area 等）保持不变。
- 单部番启停之外的多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.7.0 待裁决/范围外（2026-08-11）
- 任务 0 时 PROGRESS.md 已有 2026-08-11 10:06 dry-run 未提交行（用户操作产生），不覆盖、随本件提交。
- preload 不在本件白名单：main 已加 csv:delete IPC，renderer 的行删除通过现有 read/save 通道写 skip_eps。
- skip_eps 只影响单部单集；downloaded_end 不动；auto_repair 不补回跳过集。
- 单部番启停之外的多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.6.1 待裁决/范围外（2026-08-11）
- 时间入口合并：AniVaultAutoRun 统一由 fetch_time 驱动（填 HH:MM 创建/更新、留空删除），0.6.0 引入的第二个时间字段已全仓移除（含历史文档措辞改写，含义不变）。
- anime_updater.js 的 main() 不再调用 syncTask（旧任务 AGEAnimeUpdater 属于原仓库且已禁用），函数保留不删。
- 单部番启停之外的多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.6.0 待裁决/范围外（2026-08-11）
- 计划任务只操作 AniVaultAutoRun；旧任务 AGEAnimeUpdater 保持现状（已定格，只读不碰）。
- AniVaultAutoRun 按当前用户创建、仅登录时运行（schtasks 不带 /ru /rp）；自动运行由 scripts/auto-run.cmd 以 ELECTRON_RUN_AS_NODE=1 + AGE_RUN_MODE=password 启动 updater。
- preload 不在本件白名单，schedule:status IPC 已加在 main，renderer 经 config:save 响应展示任务状态；enabled 仅在停用时写入 false（启用状态缺省即 true，不污染条目）。
- 单部番启停之外的多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.5.0 待裁决/范围外（2026-08-10）
- 清单剩余化只作用于“本轮计划”内：下载开始前推入的计划行在结束后按结果剔除；查询全失败且 0 行时沿用 0.3.1 保留旧清单逻辑。
- EP_STATUS 只进 stdout 不进 PROGRESS；解析失败的行直接忽略；日志区仍只显示 PROGRESS。
- preload 不在本件白名单，run:episode 事件由 main 发出，renderer 通过 run:status 轮询展示。
- 单部番启停、多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.4.1 待裁决/范围外（2026-08-10）
- 部分成功推进 end 后，低于新 end 的失败集依赖 auto_repair（默认 true）补下；若用户手动关闭 auto_repair，缺口不会被自动重列——按拍板接受并记录。
- attempt_timeout_min 只作用于等待文件稳定阶段；取址与线路重试逻辑不变；不传值时仍用固定 45 分钟兜底。
- 单部番启停、多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.4.0 待裁决/范围外（2026-08-10）
- 任务书写“M3U8 永远 ffmpeg→aria2”，与既有用例“M3U8 uses aria2 with HLS”（aria2 先）冲突；按“旧断言不许改 + 默认 aria2 行为不变”拍板保留 M3U8 为 aria2→ffmpeg（永不走 IDM），已在 PROGRESS 记录。
- 引擎链：默认 aria2 = aria2→ffmpeg（不含 IDM，保持 0.3.x 行为）；选 idm = idm→aria2→ffmpeg；选 ffmpeg = ffmpeg→aria2→idm；非交互模式剔除 IDM。
- 单部番启停、多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.3.1 待裁决/范围外（2026-08-10）
- 根因已确认：18:31–18:34 的 fetch failed 是 agedm.io 间歇网络失败；本件加 fetch 失败重试 1 次（间隔 3 秒）。
- 拍板：超时逻辑不变，即超时不重试（否则默认 3 秒间隔会拖慢既有超时测试与真实超时路径）；仅非超时失败重试。
- 单部番启停、多站、安装包、顺手重构仍留后续件。

## 番仓 AniVault 0.3.0 待裁决/范围外（2026-08-10）
- 任务书写测试基线 34 项，实测 36 项（run-tests 10 + validator 14 + runner 8 + csv 4）；按实测执行，测试只增不减。
- aria2 GitHub 直连失败，经 ghfast.top 镜像下载 aria2 1.37.0 到 tools/aria2/（该目录已加入 .gitignore，不入库）。
- IDM 函数保留但主流程不再调用；auto_close_idm 配置暂不生效。
- 顺手活（重构其他模块、修别的 bug）不做；单部番启停、多站、安装包仍留后续件。

## 番仓 AniVault 0.2.0 待裁决/范围外（2026-08-10）
- content.json 在任务 0 时已有未提交改动（面板保存产生的 folder_name/file_name 空值为 null）：不覆盖、不提交，留待用户裁决。
- 单部番启停开关、多站适配、安装包：留后续件。
- anime_updater.js 的 playwright-core 绝对路径依赖：本件不改，打包时处理。
- pnpm exec electron 在本机不可用（系统 node/pnpm 不在 PATH），一律用 pnpm run scripts + 自带 node PATH。

## 番仓 AniVault Demo 范围外（2026-08-10）
- 单部番启停开关需要改 anime_updater.js，Demo 不做，留待后续件裁决。
- 站点选择、多站适配、下载按钮、安装包打包，留待后续件。
- 计划任务状态在沙箱中查询被拒绝访问，本 Demo 不涉及计划任务，无需处理。
- 必需新增 pnpm-workspace.yaml（白名单之外）：pnpm 11 默认不执行依赖构建脚本，electron 二进制需在此声明 onlyBuiltDependencies 才能下载安装；不改则 Demo 无法运行。
2026-08-07 04:31:05 BLOCKED: 反向验证: 假片名搜索不到，未写D盘
2026-08-07 06:37:32 BLOCKED: content.json 无法解析: Expected ',' or '}' after property value in JSON at position 193 (line 10 column 4)
2026-08-10 17:14:24 BLOCKED: 计划任务为密码模式，自动改时间需提供 AGE_TASK_USER/AGE_TASK_PASS，或手动运行 --install-task
2026-08-10 17:14:35 BLOCKED: 计划任务为密码模式，自动改时间需提供 AGE_TASK_USER/AGE_TASK_PASS，或手动运行 --install-task
2026-08-10 18:31:33 BLOCKED: 首页更新列表获取失败: fetch failed
2026-08-10 18:31:33 BLOCKED: 尼古喵喵: fetch failed
2026-08-10 18:31:34 BLOCKED: BanG Dream! YUME∞MITA: fetch failed
2026-08-10 18:31:35 BLOCKED: 感谢对战 大小姐才不玩格斗游戏: fetch failed
2026-08-10 18:31:35 BLOCKED: 再见，拉拉: fetch failed
2026-08-10 18:31:36 BLOCKED: 穹庐下的魔女: fetch failed
2026-08-10 18:31:36 BLOCKED: 幼女战记 第二季: fetch failed
2026-08-10 18:31:37 BLOCKED: 擅长逃跑的殿下 第二季: fetch failed
2026-08-10 18:32:01 BLOCKED: 首页更新列表获取失败: fetch failed
2026-08-10 18:32:01 BLOCKED: 尼古喵喵: fetch failed
2026-08-10 18:32:02 BLOCKED: BanG Dream! YUME∞MITA: fetch failed
2026-08-10 18:32:03 BLOCKED: 感谢对战 大小姐才不玩格斗游戏: fetch failed
2026-08-10 18:32:03 BLOCKED: 再见，拉拉: fetch failed
2026-08-10 18:32:04 BLOCKED: 穹庐下的魔女: fetch failed
2026-08-10 18:32:05 BLOCKED: 幼女战记 第二季: fetch failed
2026-08-10 18:32:05 BLOCKED: 擅长逃跑的殿下 第二季: fetch failed
2026-08-10 18:32:24 BLOCKED: 首页更新列表获取失败: fetch failed
2026-08-10 18:32:25 BLOCKED: 尼古喵喵: fetch failed
2026-08-10 18:32:25 BLOCKED: BanG Dream! YUME∞MITA: fetch failed
2026-08-10 18:32:26 BLOCKED: 感谢对战 大小姐才不玩格斗游戏: fetch failed
2026-08-10 18:32:27 BLOCKED: 再见，拉拉: fetch failed
2026-08-10 18:32:27 BLOCKED: 穹庐下的魔女: fetch failed
2026-08-10 18:32:28 BLOCKED: 幼女战记 第二季: fetch failed
2026-08-10 18:32:29 BLOCKED: 擅长逃跑的殿下 第二季: fetch failed
2026-08-10 18:32:34 BLOCKED: 首页更新列表获取失败: fetch failed
2026-08-10 18:32:34 BLOCKED: 尼古喵喵: fetch failed
2026-08-10 18:32:35 BLOCKED: BanG Dream! YUME∞MITA: fetch failed
2026-08-10 18:32:36 BLOCKED: 感谢对战 大小姐才不玩格斗游戏: fetch failed
2026-08-10 18:32:36 BLOCKED: 再见，拉拉: fetch failed
2026-08-10 18:32:37 BLOCKED: 穹庐下的魔女: fetch failed
2026-08-10 18:32:38 BLOCKED: 幼女战记 第二季: fetch failed
2026-08-10 18:32:38 BLOCKED: 擅长逃跑的殿下 第二季: fetch failed
2026-08-10 18:34:14 BLOCKED: 尼古喵喵: fetch failed
2026-08-10 18:34:15 BLOCKED: BanG Dream! YUME∞MITA: fetch failed
2026-08-10 18:34:15 BLOCKED: 感谢对战 大小姐才不玩格斗游戏: fetch failed
2026-08-10 18:34:16 BLOCKED: 再见，拉拉: fetch failed
2026-08-10 18:34:17 BLOCKED: 穹庐下的魔女: fetch failed
2026-08-10 18:34:17 BLOCKED: 幼女战记 第二季: fetch failed
2026-08-10 18:34:18 BLOCKED: 擅长逃跑的殿下 第二季: fetch failed
2026-08-10 19:17:11 BLOCKED: 擅长逃跑的殿下 第二季 第1集: 下载失败 线路5取址失败
2026-08-10 19:17:11 BLOCKED: 擅长逃跑的殿下 第二季 第2集: 下载失败 线路5取址失败
2026-08-20 16:59:26 BLOCKED: 穹庐下的魔女: fetch failed
2026-08-20 16:59:30 BLOCKED: Re：从零开始的异世界生活 第四季 丧失篇: fetch failed
2026-08-20 16:59:44 BLOCKED: 首页更新列表获取失败: fetch failed
2026-08-20 16:59:48 BLOCKED: 尼古喵喵: fetch failed
2026-08-20 16:59:52 BLOCKED: 感谢对战 大小姐才不玩格斗游戏: fetch failed
2026-08-20 16:59:57 BLOCKED: 再见，拉拉: fetch failed
2026-08-20 17:00:01 BLOCKED: 穹庐下的魔女: fetch failed
2026-08-20 17:00:05 BLOCKED: Re：从零开始的异世界生活 第四季 丧失篇: fetch failed
2026-08-27 18:05:49 BLOCKED: Re：从零开始的异世界生活 第四季 丧失篇 第14集: 下载失败 线路5取址失败
2026-08-30 18:22:01 BLOCKED: 穹庐下的魔女 第10集: 下载失败 线路5 ffmpeg 失败 exit=1: 完成文件改名失败: EPERM: operation not permitted, rename 'D:\idm下载\8_穹庐下的魔女1-9\穹庐下的魔女 第10集 - 在线播放 - AGE动漫_L5.part.mp4' -> 'D:\idm下载\8_穹庐下的魔女1-9\穹庐下的魔女 第10集 - 在线播放 - AGE动漫_L5.mp4'
2026-08-31 18:59:28 BLOCKED: 再见，拉拉 第9集: 下载失败 线路5 ffmpeg 失败 exit=1: 完成文件改名失败: EPERM: operation not permitted, rename 'D:\idm下载\8_再见，拉拉1-8\再见，拉拉 第09集 - 在线播放 - AGE动漫_L5.part.mp4' -> 'D:\idm下载\8_再见，拉拉1-8\再见，拉拉 第09集 - 在线播放 - AGE动漫_L5.mp4'
2026-08-31 19:48:56 BLOCKED: 穹庐下的魔女 第10集: 下载失败 线路5 ffmpeg 失败 exit=1: 完成文件改名失败: EPERM: operation not permitted, rename 'D:\idm下载\8_穹庐下的魔女1-9\穹庐下的魔女 第10集 - 在线播放 - AGE动漫_L5.part.mp4' -> 'D:\idm下载\8_穹庐下的魔女1-9\穹庐下的魔女 第10集 - 在线播放 - AGE动漫_L5.mp4'
2026-09-01 18:16:03 BLOCKED: 再见，拉拉 第9集: 下载失败 线路5 ffmpeg 失败 exit=1: 完成文件改名失败: EPERM: operation not permitted, rename 'D:\idm下载\8_再见，拉拉1-8\再见，拉拉 第09集 - 在线播放 - AGE动漫_L5.part.mp4' -> 'D:\idm下载\8_再见，拉拉1-8\再见，拉拉 第09集 - 在线播放 - AGE动漫_L5.mp4'
2026-09-01 18:35:05 BLOCKED: 穹庐下的魔女 第10集: 下载失败 线路5 ffmpeg 失败 exit=1: 完成文件改名失败: EPERM: operation not permitted, rename 'D:\idm下载\8_穹庐下的魔女1-9\穹庐下的魔女 第10集 - 在线播放 - AGE动漫_L5.part.mp4' -> 'D:\idm下载\8_穹庐下的魔女1-9\穹庐下的魔女 第10集 - 在线播放 - AGE动漫_L5.mp4'
