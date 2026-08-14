# AniVault Hidden Scheduled Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AniVaultAutoRun` execute the updater without creating a command window or Windows Terminal tab.

**Architecture:** Keep `scripts/auto-run.cmd` as the visible manual-debug launcher and add `scripts/auto-run.vbs` as the scheduled-task launcher. `wscript.exe` runs the VBS through the Windows GUI subsystem; the VBS sets the two existing environment variables, launches the project Electron runtime with window style `0`, waits, and forwards its exit code.

**Tech Stack:** Node.js CommonJS, Electron, Windows Task Scheduler (`schtasks.exe`), Windows Script Host VBScript, built-in `node:assert`.

## Global Constraints

- Only modify `AniVaultAutoRun`; do not create, update, enable, disable, or delete `AGEAnimeUpdater`.
- Keep `scripts/auto-run.cmd` unchanged for manual debugging.
- Add no npm dependencies.
- Preserve existing user changes in `content.json` and `PROGRESS.md`.
- Bump all current-version surfaces from `0.9.0` to `0.9.1`.
- Do not stage `local/`, `tools/aria2/`, `tools/ffmpeg/ffmpeg.exe`, or `node_modules/`.

---

### Task 1: Add the hidden launcher and wire scheduling to it

**Files:**
- Create: `scripts/auto-run.vbs`
- Modify: `src/schedule.js:5-12`
- Modify: `electron/main.js:275-278`
- Test: `tests/schedule.test.js`

**Interfaces:**
- Consumes: `syncSchedule({ time, launcherPath, schtasks })`, where `launcherPath` is the absolute VBS path.
- Produces: a `/tr` value shaped as `wscript.exe //B //NoLogo "<absolute-vbs-path>"` and a VBS process that returns the updater exit code.

- [ ] **Step 1: Write failing scheduler and launcher tests**

Change the launcher constant and first scheduler assertion in `tests/schedule.test.js`, then add two focused tests:

```js
const fs = require('node:fs');
const path = require('node:path');

const LAUNCHER = 'D:\\x\\scripts\\auto-run.vbs';

test('有 HH:MM 时通过 wscript 创建无窗口任务', () => {
  const calls = [];
  const st = fakeSchtasks((cmd, args) => {
    calls.push(args);
    if (args[0] === '/query') return { status: 1, stdout: '', stderr: 'not found' };
    return { status: 0, stdout: 'ok', stderr: '' };
  });
  const r = syncSchedule({ time: '18:00', launcherPath: LAUNCHER, schtasks: st });
  assert.equal(r.ok, true);
  const create = calls.find(a => a[0] === '/create');
  const taskCommand = create[create.indexOf('/tr') + 1];
  assert.equal(taskCommand, `wscript.exe //B //NoLogo "${LAUNCHER}"`);
});

test('计划任务入口设置后台环境并隐藏等待子进程', () => {
  const launcher = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'auto-run.vbs'), 'utf8');
  assert.match(launcher, /ELECTRON_RUN_AS_NODE/);
  assert.match(launcher, /AGE_RUN_MODE/);
  assert.match(launcher, /shell\.Run\(command, 0, True\)/i);
  assert.match(launcher, /WScript\.Quit exitCode/i);
});

test('Electron 保存配置时同步 VBS 启动器', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  assert.match(main, /path\.join\(appRoot\(\), 'scripts', 'auto-run\.vbs'\)/);
  assert.doesNotMatch(main, /launcherPath:.*auto-run\.cmd/);
});
```

- [ ] **Step 2: Run the schedule test and verify RED**

Run: `node tests/schedule.test.js`

Expected: FAIL because the `/tr` value still directly contains the launcher path, `scripts/auto-run.vbs` does not exist, and `electron/main.js` still selects `auto-run.cmd`.

- [ ] **Step 3: Implement the minimal hidden VBS launcher**

Create `scripts/auto-run.vbs`:

```vbscript
Option Explicit

Dim shell, fso, appDir, electronPath, updaterPath, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
electronPath = fso.BuildPath(appDir, "node_modules\electron\dist\electron.exe")
updaterPath = fso.BuildPath(appDir, "anime_updater.js")

shell.Environment("Process")("ELECTRON_RUN_AS_NODE") = "1"
shell.Environment("Process")("AGE_RUN_MODE") = "password"

command = """" & electronPath & """ """ & updaterPath & """"
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
```

- [ ] **Step 4: Make Task Scheduler invoke the GUI-subsystem host**

Change `buildCreateArgs` in `src/schedule.js` to:

```js
function buildCreateArgs(time, launcherPath) {
  const taskCommand = `wscript.exe //B //NoLogo "${launcherPath}"`;
  return ['/create', '/tn', TASK_NAME, '/tr', taskCommand, '/sc', 'daily', '/st', time, '/f'];
}
```

Change the launcher path in `electron/main.js` to:

```js
launcherPath: path.join(appRoot(), 'scripts', 'auto-run.vbs'),
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node tests/schedule.test.js`

Expected: `8 PASS, 0 FAIL, skipped=0`.

- [ ] **Step 6: Commit the behavior change**

```powershell
git add -- scripts/auto-run.vbs src/schedule.js electron/main.js tests/schedule.test.js docs/superpowers/plans/2026-08-14-hidden-scheduled-launcher.md
git commit -m "fix: hide scheduled updater console"
```

### Task 2: Publish version 0.9.1 documentation

**Files:**
- Modify: `VERSION`
- Modify: `package.json:4`
- Modify: `AGENTS.md:5`
- Modify: `README.md:1,19,67`
- Modify: `使用说明.md:3-5,171`

**Interfaces:**
- Consumes: the Task 1 behavior and exact launcher names.
- Produces: synchronized current-version declarations and user guidance for the hidden scheduled launcher.

- [ ] **Step 1: Update current-version surfaces to 0.9.1**

Set `VERSION` to `0.9.1`, set `package.json` version to `0.9.1`, replace the current-version sentence in `AGENTS.md`, update the README title and current-version sentence, and update the leading current-version line in `使用说明.md`.

- [ ] **Step 2: Document the new scheduled-task behavior**

In `README.md`, change the daily-run bullet to state that `AniVaultAutoRun` uses `wscript.exe` plus `scripts/auto-run.vbs` and does not open a terminal tab; add a `0.9.1` behavior bullet without rewriting the historical `0.9.0` bullet.

At the top of `使用说明.md`, add:

```markdown
0.9.1 行为说明：计划任务 AniVaultAutoRun 改由 wscript.exe 调用 scripts/auto-run.vbs，无窗口启动 Electron 的 Node 模式；每日自动追更不再弹出命令行窗口或 Windows Terminal 标签。scripts/auto-run.cmd 保留用于手动调试，旧任务 AGEAnimeUpdater 不变。
```

Add this version-history row above `v0.9.0`:

```markdown
| v0.9.1 | 修复每日自动运行弹出命令行窗口或 Windows Terminal 标签：AniVaultAutoRun 改由 wscript.exe 调用 scripts/auto-run.vbs，无窗口启动 Electron Node 模式并传递退出码；保留 auto-run.cmd 供手动调试；旧任务 AGEAnimeUpdater 不变。 |
```

- [ ] **Step 3: Verify version and launcher references**

Run:

```powershell
Get-Content VERSION
node -p "require('./package.json').version"
rg -n "0\.9\.1|auto-run\.vbs|auto-run\.cmd" AGENTS.md README.md 使用说明.md VERSION package.json electron/main.js src/schedule.js scripts tests/schedule.test.js
```

Expected: all active current-version declarations are `0.9.1`; active scheduling references use `auto-run.vbs`; `auto-run.cmd` remains only as the manual-debug launcher or historical text.

- [ ] **Step 4: Commit the release documentation**

```powershell
git add -- VERSION package.json AGENTS.md README.md 使用说明.md
git commit -m "docs: release version 0.9.1"
```

### Task 3: Verify and update the live scheduled task

**Files:**
- No repository file changes expected.
- External state: Windows scheduled task `AniVaultAutoRun` only.

**Interfaces:**
- Consumes: `src/schedule.js`, current `content.json.fetch_time`, and `scripts/auto-run.vbs`.
- Produces: a ready scheduled task whose action is `wscript.exe //B //NoLogo "D:\project_codex\番仓\scripts\auto-run.vbs"`.

- [ ] **Step 1: Run all repository verification commands**

Run:

```powershell
pnpm test
node tests/validator.test.js
node tests/runner.test.js
node tests/csv.test.js
node tests/resilience.test.js
node tests/schedule.test.js
node tests/summary.test.js
node tests/logutil.test.js
node tests/ui-check.js
pnpm run selftest
git diff --check
git status --short --ignored
```

Expected: every test reports zero failures; self-test prints `SELFTEST_OK`; formatting check exits `0`; ignored local artifacts remain untracked/ignored and unstaged.

- [ ] **Step 2: Recreate only AniVaultAutoRun with the hidden launcher**

Run:

```powershell
node -e "const path=require('node:path'); const {syncSchedule}=require('./src/schedule'); const cfg=require('./content.json'); const r=syncSchedule({time:cfg.fetch_time,launcherPath:path.join(process.cwd(),'scripts','auto-run.vbs')}); console.log(JSON.stringify(r)); process.exit(r.ok?0:1)"
```

Expected: JSON contains `"ok":true` and action `"updated"` or `"created"`.

- [ ] **Step 3: Inspect the exact live task action**

Run:

```powershell
$task = Get-ScheduledTask -TaskName 'AniVaultAutoRun'
$task | Select-Object TaskName,State,@{N='LogonType';E={$_.Principal.LogonType}} | Format-List
$task.Actions | Select-Object Execute,Arguments,WorkingDirectory | Format-List
```

Expected: task state is `Ready`, logon type remains `Interactive`, executable is `wscript.exe`, and arguments contain `//B //NoLogo` plus the absolute VBS path. `AGEAnimeUpdater` is not queried or changed.

- [ ] **Step 4: Run the task once and inspect its result**

Run:

```powershell
Start-ScheduledTask -TaskName 'AniVaultAutoRun'
Start-Sleep -Seconds 3
Get-ScheduledTaskInfo -TaskName 'AniVaultAutoRun' | Select-Object LastRunTime,LastTaskResult,NextRunTime
```

Expected: no command window or Windows Terminal tab appears. The task starts through WScript; after the updater finishes, `LastTaskResult` is `0`. Because this is a real updater run, preserve any resulting user-data or log changes rather than resetting them.

- [ ] **Step 5: Confirm the final repository state**

Run:

```powershell
git status --short
git log -3 --oneline
```

Expected: only the user's pre-existing `content.json` and `PROGRESS.md` changes, plus any legitimate real-run updates to those same files, remain unstaged. The design commit and two implementation commits are present.
