# AniVault 无窗口计划任务启动设计

> 历史设计，现已实现。当前计划任务仍使用 `scripts/auto-run.vbs`；当前版本和完整操作说明以根目录 `README.md`、`使用说明.md` 为准。

## 目标

让 Windows 计划任务 `AniVaultAutoRun` 在用户已登录时执行自动追更，但不创建命令行窗口或 Windows Terminal 标签。保留现有 `scripts/auto-run.cmd`，供人工调试使用。

## 根因

当前计划任务直接执行 `scripts/auto-run.cmd`。该任务使用交互式登录令牌，批处理入口会创建控制台；Windows Terminal 接管控制台后表现为弹出新标签。updater 内部子进程已使用隐藏窗口参数，因此不需要修改下载链路。

## 方案

新增 `scripts/auto-run.vbs` 作为计划任务专用入口。脚本通过 `WScript.Shell`：

1. 从自身位置计算项目根目录，不写死仓库绝对路径。
2. 为子进程设置 `ELECTRON_RUN_AS_NODE=1` 和 `AGE_RUN_MODE=password`。
3. 以窗口样式 `0` 启动项目内 Electron，运行 `anime_updater.js`。
4. 等待 updater 结束，并将退出码传回任务计划程序。

`src/schedule.js` 仍接收一个启动器路径，不增加新的调度抽象。Electron 主进程把计划任务启动器从 `auto-run.cmd` 改为 `auto-run.vbs`，`schtasks` 的 `/tr` 明确调用系统 `wscript.exe //B //NoLogo`。旧任务 `AGEAnimeUpdater` 保持不变。

## 错误处理

VBS 找不到 Electron 或 updater 时，由 `WScript.Shell.Run` 返回非零状态或产生脚本错误；任务计划程序记录失败。正常情况下 updater 继续写入现有日志，计划任务不依赖可见终端输出。

## 测试与验收

- 调度单元测试证明创建命令使用 `wscript.exe //B //NoLogo` 和 VBS 全路径，不再直接执行 CMD。
- 静态测试证明 VBS 设置两个既有环境变量、使用隐藏窗口样式、等待进程并传递退出码。
- `pnpm test` 全量通过。
- 真实同步后，`AniVaultAutoRun` 的动作指向 `wscript.exe` 与 `scripts/auto-run.vbs`。
- 手动运行一次计划任务，任务能结束且不出现命令行窗口或 Terminal 标签。

## 版本与文档

这是计划任务行为修复，版本从 `0.9.0` 升至 `0.9.1`。同步更新 `VERSION`、`package.json`、`README.md`、`使用说明.md` 和必要的项目记录。用户已有的 `content.json` 与 `PROGRESS.md` 修改不覆盖、不回滚。
