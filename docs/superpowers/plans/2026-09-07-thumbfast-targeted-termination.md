# Thumbfast Targeted Termination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mpv 正常关闭后，目录改名重试仍因 `EBUSY` / `EPERM` 失败时，只结束该主播放器对应的 thumbfast 子进程，然后再改名一次。

**Architecture:** 复用现有约 10 秒目录重试。重试耗尽后，用主 mpv PID 构造 thumbfast 独有的管道和输出文件标记，仅枚举并结束同时匹配两个标记的 `mpv.exe`。非 Windows、无有效主 PID、查询失败或未找到唯一子进程时都不强杀。

**Tech Stack:** Node.js standard library, PowerShell `Get-CimInstance`, Windows `taskkill.exe`, Node test runner.

## Global Constraints

- 不使用 `taskkill /IM mpv.exe` 或 `/T`。
- 不结束主 mpv PID，不结束无唯一 thumbfast 标记的进程。
- 保留现有 20 次、500ms 的 `EBUSY` / `EPERM` 重试。
- 不新增依赖，不修改用户的 mpv 第三方脚本。

---

### Task 1: 精准结束 thumbfast 后恢复改名

**Files:**
- Modify: `integrations/mpv-watched-prefix/apply-watched-prefix.js`
- Test: `integrations/mpv-watched-prefix/tests/watched-prefix.test.js`

**Interfaces:**
- Consumes: `main()` 已解析的 `--pid`，`applyQualifiedRenames(options)` 的目录改名结果。
- Produces: `terminateThumbfastForMpv(mpvPid, options)` 返回被结束的 PID 数组；`applyQualifiedRenames()` 返回 `terminatedThumbfast` 供日志记录。

- [x] **Step 1: Write the failing tests**

  添加测试验证只对同时匹配主 PID、`thumbfast<PID>` 管道与 `thumbfast.out<PID>` 的唯一数字 PID 调用 `taskkill /PID <pid> /F`，并验证常规重试失败后只再改名一次。

- [x] **Step 2: Run the focused test and verify RED**

  Run: `node --test integrations/mpv-watched-prefix/tests/watched-prefix.test.js`

  Expected: FAIL because `terminateThumbfastForMpv` and the fallback path do not exist.

- [x] **Step 3: Implement the minimum Windows-only fallback**

  用 `spawnSync` 调用 PowerShell 枚举精确匹配的子进程，再用 PID 调用 `taskkill.exe`。将主 mpv PID 从 `main()` 传入 `runSession()` 和 `applyQualifiedRenames()`；只在原错误为 `EBUSY` / `EPERM` 且确实结束了匹配子进程后再改名一次。

- [x] **Step 4: Run focused and full verification**

  Run: `node --test integrations/mpv-watched-prefix/tests/watched-prefix.test.js`

  Expected: all focused tests pass.

  Run: `pnpm test`

  Expected: 0 failures, including UI version consistency checks.

### Task 2: Release records

**Files:**
- Modify: `VERSION`, `package.json`, `renderer/index.html`, `AGENTS.md`, `README.md`, `使用说明.md`, `integrations/mpv-watched-prefix/README.md`

**Interfaces:**
- Consumes: the verified fallback behavior from Task 1.
- Produces: one consistent release version and user-facing recovery description.

- [x] **Step 1: Bump the patch version and document the exact fallback**

  将版本从 `0.12.3` 升到 `0.12.4`，说明“先有界重试，再精准结束对应 thumbfast 子进程，最后改名一次”。

- [x] **Step 2: Verify and commit only scoped files**

  Run: `git diff --check`, `pnpm test`, `git status --short --ignored`.

  Expected: checks pass; `.gitignore`, runtime data, personal files and unrelated untracked files remain unstaged.
