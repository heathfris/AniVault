# BLOCKED

无

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
