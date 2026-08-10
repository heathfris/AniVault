# 西瓜线路双通道下载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保持西瓜线路为默认链路，并让 MP4 直链由 IDM、M3U8 由 ffmpeg 下载，完成真实第 7 集下载。

**Architecture:** `downloadEpisode` 保持线路顺序，按 URL 类型选择 `callIdm` 或 `callFfmpeg`。两种下载器都写入同一目标目录并经过统一的文件完成判定；失败时记录原因并继续备用线路。

**Tech Stack:** Node.js、现有 Playwright 取址、Internet Download Manager、ffmpeg、Node 内置测试工具。

## Global Constraints

- 线路顺序必须保持 `[1, 2, 3, 4, 5]`，线路 1 是默认优先级。
- 不改变 `content.json` 的字段语义和现有 IDM MP4 下载行为。
- 不把未完成的临时文件当成成功文件。
- 真实验收必须以目标文件、进度字段和日志三者同时成立为准。

---

### Task 1: 双通道行为测试

**Files:**
- Modify: `tests/run-tests.js`
- Modify: `anime_updater.js` only after the tests fail

**Interfaces:**
- Consumes: `downloadEpisode(anime, ep, folder, deps)`.
- Produces: injectable `callFfmpeg` behavior and URL-type routing expectations.

- [ ] **Step 1: Write failing tests**

Add tests asserting that an `.m3u8` URL calls `callFfmpeg` and not `callIdm`, while an `.mp4` URL still calls `callIdm`; add a failure test proving a failed first channel reaches source 2.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/run-tests.js`

Expected: FAIL because the current implementation sends every URL to IDM and has no `callFfmpeg` dependency.

### Task 2: Implement routing and robust process wrappers

**Files:**
- Modify: `anime_updater.js:1-240`
- Modify: `README.md`
- Modify: `使用说明.md`

**Interfaces:**
- `callFfmpeg(url, folder, filename, headers)` returns `{ status }` and writes a temporary output.
- `downloadEpisode` accepts optional `callFfmpeg` and `getPlayHeaders` dependencies.

- [ ] **Step 1: Implement the smallest code to satisfy the failing tests**

Classify URLs using the existing media pattern. Keep source order unchanged. Route M3U8 to ffmpeg, MP4 to IDM, pass Referer/User-Agent, and preserve the existing stable-file check and fallback loop.

- [ ] **Step 2: Run focused tests and verify they pass**

Run: `node tests/run-tests.js`

Expected: PASS for MP4 IDM routing, M3U8 ffmpeg routing, and source fallback.

- [ ] **Step 3: Update documentation**

Document the ffmpeg prerequisite and the MP4/M3U8 routing without changing the default source priority.

### Task 3: Dependency and complete verification

**Files:**
- Modify: `TESTING.md` if the command sequence changes
- Runtime: `F:\IDM\Internet Download Manager\IDMan.exe`, `ffmpeg.exe`, `D:\idm下载`

- [ ] **Step 1: Confirm or install ffmpeg**

Run: `Get-Command ffmpeg.exe`

Expected: an executable path. If absent, install a trusted local ffmpeg package before the real run.

- [ ] **Step 2: Run all tests**

Run: `node tests/run-tests.js`

Expected: exit code 0 and all test cases report PASS.

- [ ] **Step 3: Run the updater once in real mode**

Run: `node anime_updater.js`

Expected: the log starts with source 1 for 穹庐下的魔女 第 7 集, records the selected channel, and ends with a completion line or an explicit evidence-backed failure.

- [ ] **Step 4: Verify the real outcome**

Check the target file under `D:\idm下载`, its size is at least 100 MB, `content.json` has `downloaded_end: 7`, the folder name ends in `1-7`, and `PROGRESS.md` contains the completion record.
