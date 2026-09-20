# AniVault Security Quality Repair Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with review checkpoints. Each task follows TDD: failing test, verified failure, minimal implementation, focused verification.

**Goal:** 修复审查确认的并发、写入竞争、Portable mpv 路径和低成本安全质量缺陷。

**Architecture:** 保持现有模块边界。下载模块只把外部进程调用改为异步；文件锁作为共享的小型基础模块供 Electron 和 updater 使用；mpv 通过已有配置生成和 helper 参数传递真实数据路径。

**Tech Stack:** Node.js、Electron、Lua mpv script、内置 `node:test`、pnpm。

## Global Constraints

- 不删除或回滚 `content.json`、`PROGRESS.md`、`BLOCKED.md` 和 `local/` 用户现场数据。
- 不引入第三方依赖。
- 行为、路径或用户流程变化后同步 `VERSION`、`package.json`、`README.md`、`使用说明.md` 和 UI 版本徽标。
- 每项实现前必须有对应失败测试。

### Task 1: 异步下载引擎

**Files:**
- Modify: `tests/download-module.test.js` 或 `tests/run-tests.js`
- Modify: `src/download.js`
- Modify: `anime_updater.js`（仅适配返回 Promise 的调用点）

- [ ] 添加测试：模拟 ffmpeg/aria2 子进程在退出前保持运行，断言 `callFfmpeg`/`callAria2` 返回 Promise 且调用不阻塞第二个 worker。
- [ ] 运行测试确认旧实现失败。
- [ ] 用异步 `spawn` 包装退出、错误和超时，保持返回 `{status, stderr}` 兼容结构。
- [ ] 运行下载模块测试和现有并发测试。

### Task 2: 共享文件锁与写入保护

**Files:**
- Create: `src/file-lock.js`
- Test: `tests/file-lock.test.js`
- Modify: `electron/main.js`
- Modify: `anime_updater.js`

- [ ] 添加两个进程竞争同一锁、释放后可重试、异常退出可识别的测试。
- [ ] 运行测试确认锁模块不存在或行为不满足。
- [ ] 实现基于独占创建的锁，并让面板和 updater 在写配置/CSV前使用同一路径。
- [ ] 验证 busy 时不覆盖文件，随后运行现有 CSV、配置和全套测试。

### Task 3: Portable mpv 数据路径

**Files:**
- Test: `tests/mpv-watched-prefix-manager.test.js`, `integrations/mpv-watched-prefix/tests/watched-prefix.test.js`
- Modify: `electron/main.js`
- Modify: `src/mpv-watched-prefix-manager.js`
- Modify: `integrations/mpv-watched-prefix/anivault-watched.lua`
- Modify: `integrations/mpv-watched-prefix/apply-watched-prefix.js`

- [ ] 添加 packaged 配置测试，断言 `content_file`、`download_root` 和 `state_dir` 使用 userData/配置值。
- [ ] 运行测试确认旧配置缺少这些路径。
- [ ] 扩展 mpv conf 和 helper 参数，使用 runner 的 Electron Node 环境变量。
- [ ] 运行 mpv 同步测试、自检和 smoke。

### Task 4: 输入、渲染和站点健壮性

**Files:**
- Test: `tests/site-module.test.js`, `tests/csv.test.js`, `tests/folders-module.test.js`, `tests/ui-check.js`
- Modify: `src/site.js`, `src/csv.js`, `src/folders.js`, `renderer/renderer.js`, `renderer/index.html`, `electron/main.js`, `src/download.js`

- [ ] 为动态 base URL、带引号 CSV、点目录名、扩展名临时文件和 CSP/导航策略添加失败测试。
- [ ] 运行对应测试确认旧实现失败。
- [ ] 实现最小修复，不改变现有公开字段和 UI 流程。
- [ ] 运行全部测试并检查 diff。

### Task 5: 版本文档与最终验证

**Files:**
- Modify: `VERSION`, `package.json`, `README.md`, `使用说明.md`, `renderer/index.html`

- [ ] 根据实际行为更新版本和文档，保留用户数据文件。
- [ ] 运行 `pnpm test`。
- [ ] 运行 `pnpm run selftest` 和 `pnpm run smoke`。
- [ ] 运行 `git diff --check`、`git status --short --ignored`，审阅所有变更。
