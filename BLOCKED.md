# BLOCKED

无

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
