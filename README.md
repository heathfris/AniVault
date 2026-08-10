# 番仓 AniVault（Demo 0.2.0）

AGE 动漫自动追更下载器的新桌面面板。当前是可用的 Demo：除了查看、修改并保存 `content.json`，还能在面板里触发 dry-run / 立即下载、停止运行、看实时日志与待下载清单、打开下载目录。原自动更新脚本保持原样。

## 能做什么（当前范围）

- 全局设置与追番清单增删改查，保存前逐字段校验、原子写盘、未知字段保留
- 运行控制：Dry-run 检查更新 / 立即下载 / 停止
- 单实例锁：同一时间只允许一个任务（`local/run.lock`，僵尸锁自动清理）
- 实时日志：本次运行输出 + PROGRESS 末尾
- 待下载清单表格（可刷新）
- 打开下载目录、环境信息只读

暂不包含：站点选择、多站爬取、单部番启停开关、安装包（见 BLOCKED.md）。

## 环境

- Windows
- Node.js 与 pnpm：本机 node/pnpm 不在系统 PATH，运行前先把自带运行时加进 PATH，或用完整路径调用 pnpm
- Electron 43 已随项目安装

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
```

当前版本 0.2.0，版本记录见使用说明.md 文末。
