# Local Workspace Organization and Maintenance Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move three local-only artifacts into an ignored `local/` directory, write generated CSV files there, release version 1.4.0 with synchronized documentation, and install a personal maintenance Skill that prevents future version drift.

**Architecture:** Keep all runtime configuration, logs, the main script, tests, and scheduled-task paths unchanged. Add a small path helper and parent-directory creation around CSV output, then make `local/` the single ignored home for local artifacts. Install the project-specific maintenance rule as a global personal Skill so future Codex sessions can discover it without adding Skill files to this repository.

**Tech Stack:** Node.js CommonJS, built-in `node:assert`, PowerShell, Git, Codex personal Skills, Python Skill validation scripts

## Global Constraints

- Keep `anime_updater.js`, `content.json`, `task_state.json`, `PROGRESS.md`, `BLOCKED.md`, and `VERSION` in the project root.
- Keep the scheduled task action pointing to `D:\project_codex\AGE动画_GET\anime_updater.js`.
- Move only the fault report, GitHub guide, and generated download list into `local/`.
- Ignore the complete `local/` directory and never stage any file under it.
- Keep `tools/ffmpeg/ffmpeg.exe` ignored.
- Change the project version from the actual code version `1.3.4` to `1.4.0`.
- Add the missing `v1.3.4` documentation before adding `v1.4.0`.
- Use test-first development for CSV behavior and RED/GREEN validation for the personal Skill.
- Do not push to a remote unless the user separately requests it.

---

## File Structure

**Project files created or changed**

- Modify `anime_updater.js` to expose the default CSV path and create its parent directory.
- Modify `tests/run-tests.js` to cover the new path and directory creation.
- Modify `.gitignore` to ignore `local/` as one unit.
- Modify `VERSION`, `README.md`, and `使用说明.md` for release 1.4.0.
- Delete the tracked path `docs/故障修复报告-2026-08-09.md` after preserving its local copy.
- Keep local copies at `local/故障修复报告-2026-08-09.md`, `local/GitHub使用教程.md`, and `local/待下载清单.csv`; these paths remain untracked.

**Personal Skill files created outside the repository**

- Create `C:\Users\15269\.codex\skills\maintaining-age-anime\SKILL.md`.
- Create `C:\Users\15269\.codex\skills\maintaining-age-anime\agents\openai.yaml` through the Skill initialization script.

---

### Task 1: Write Generated CSV Files Under `local/`

**Files:**

- Modify `tests/run-tests.js:10-182`
- Modify `anime_updater.js:6-20`
- Modify `anime_updater.js:484-487`
- Modify `anime_updater.js:721`

**Interfaces:**

- Consumes `WORK`, `process.env.AGE_CSV`, `fs`, and `path`.
- Produces `getCsvPath(workDir: string, env: object): string`.
- Produces `writeCsv(rows: Array<{title: string, ep: number, url: string}>, csvPath?: string): void`.
- Keeps `AGE_CSV` as the highest-priority override.

- [ ] **Step 1: Add failing path and parent-directory tests**

Extend the import in `tests/run-tests.js`.

```js
const {
  downloadEpisode,
  formatLogTime,
  getCsvPath,
  getFfmpegPath,
  getFfmpegTempPath,
  getEpisodeFileMatcher,
  writeCsv,
} = require('../anime_updater.js');
```

Add these tests before the existing time test.

```js
function testDefaultCsvPathUsesLocalFolder() {
  const workDir = path.join('D:', 'project', 'AGE动画_GET');
  assert.equal(
    getCsvPath(workDir, {}),
    path.join(workDir, 'local', '待下载清单.csv'),
  );
  assert.equal(
    getCsvPath(workDir, { AGE_CSV: 'E:\\custom\\list.csv' }),
    'E:\\custom\\list.csv',
  );
}

function testWriteCsvCreatesParentDirectory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'age-anime-csv-'));
  try {
    const csvPath = path.join(root, 'local', '待下载清单.csv');
    writeCsv([{ title: 'Test Anime', ep: 2, url: 'https://example.test/play/2' }], csvPath);
    assert.equal(fs.existsSync(csvPath), true);
    const text = fs.readFileSync(csvPath, 'utf8');
    assert.match(text, /Test Anime,2,https:\/\/example\.test\/play\/2/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
```

Add both tests at the start of the promise chain.

```js
Promise.resolve()
  .then(testDefaultCsvPathUsesLocalFolder)
  .then(() => console.log('PASS default CSV path uses local folder'))
  .then(testWriteCsvCreatesParentDirectory)
  .then(() => console.log('PASS CSV writer creates parent directory'))
  .then(testLogTimeUsesShanghaiTimezone)
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests/run-tests.js
```

Expected: exit code 1 with `TypeError: getCsvPath is not a function` or `TypeError: writeCsv is not a function`.

- [ ] **Step 3: Implement the minimal CSV path behavior**

Replace the current CSV constant in `anime_updater.js` with:

```js
function getCsvPath(workDir = WORK, env = process.env) {
  return env.AGE_CSV || path.join(workDir, 'local', '待下载清单.csv');
}

const CSV = getCsvPath();
```

Replace `writeCsv` with:

```js
function writeCsv(rows, csvPath = CSV) {
  const lines = ['动漫,集数,播放页URL', ...rows.map(r => `${r.title},${r.ep},${r.url}`)];
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  fs.writeFileSync(csvPath, '\uFEFF' + lines.join('\r\n'), 'utf8');
}
```

Add `getCsvPath` and `writeCsv` to `module.exports` without changing the other exports.

- [ ] **Step 4: Run all tests and verify GREEN**

Run:

```powershell
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check anime_updater.js
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests/run-tests.js
```

Expected: syntax check exits 0 and ten `PASS` lines appear, including the two new CSV tests.

- [ ] **Step 5: Commit the CSV behavior**

```powershell
git add anime_updater.js tests/run-tests.js
git commit -m "feat: write download list under local directory"
```

Expected: one commit containing only the production and test changes.

---

### Task 2: Consolidate Local-Only Artifacts

**Files:**

- Modify `.gitignore`
- Delete tracked path `docs/故障修复报告-2026-08-09.md`
- Preserve ignored local path `local/故障修复报告-2026-08-09.md`
- Move ignored path `GitHub使用教程.md` to `local/GitHub使用教程.md`
- Move ignored path `待下载清单.csv` to `local/待下载清单.csv`

**Interfaces:**

- Consumes the `local/待下载清单.csv` default from Task 1.
- Produces one ignored `local/` directory containing exactly the three requested artifacts before the next dry-run.

- [ ] **Step 1: Verify every source file before moving anything**

Run:

```powershell
$targets = @(
  'docs\故障修复报告-2026-08-09.md',
  'GitHub使用教程.md',
  '待下载清单.csv'
)
$targets | ForEach-Object { "$_=$((Test-Path -LiteralPath $_).ToString().ToLower())" }
```

Expected: all three lines end in `true`. Stop without moving files if any source is missing.

- [ ] **Step 2: Create `local/` and move the three files**

Run with explicit literal paths:

```powershell
New-Item -ItemType Directory -Path 'local' -Force | Out-Null
Move-Item -LiteralPath 'docs\故障修复报告-2026-08-09.md' -Destination 'local\故障修复报告-2026-08-09.md'
Move-Item -LiteralPath 'GitHub使用教程.md' -Destination 'local\GitHub使用教程.md'
Move-Item -LiteralPath '待下载清单.csv' -Destination 'local\待下载清单.csv'
```

Expected: all source paths disappear and all three `local/` paths exist.

- [ ] **Step 3: Replace per-file ignore rules with the directory rule**

Set `.gitignore` to exactly:

```gitignore
local/
tools/ffmpeg/ffmpeg.exe
```

- [ ] **Step 4: Verify the Git boundary**

Run:

```powershell
git check-ignore -v local/GitHub使用教程.md local/待下载清单.csv local/故障修复报告-2026-08-09.md
git ls-files local
git status --short
```

Expected: `git check-ignore` reports `.gitignore:1:local/` for all three files, `git ls-files local` prints nothing, and `git status` shows `.gitignore` modified plus the tracked fault report deleted. No `local/` file appears as staged or untracked.

- [ ] **Step 5: Commit the local-only boundary**

```powershell
git add .gitignore docs/故障修复报告-2026-08-09.md
git commit -m "chore: keep local artifacts out of git"
```

Expected: the commit records the ignore change and report removal while all local copies remain on disk.

---

### Task 3: Synchronize Release 1.4.0 Documentation

**Files:**

- Modify `VERSION`
- Modify `README.md`
- Modify `使用说明.md`

**Interfaces:**

- Consumes the `local/` path and download-mode behavior already implemented.
- Produces one consistent public version, `1.4.0`, in all current-version locations.
- Preserves historical `v1.3.3` text as a version-history row and adds the missing `v1.3.4` row.

- [ ] **Step 1: Record the pre-update version mismatch**

Run:

```powershell
Get-Content -Encoding UTF8 VERSION
Select-String -Path README.md,'使用说明.md' -Pattern '1\.3\.3|1\.3\.4' -Encoding UTF8
```

Expected: `VERSION` prints `1.3.4`, while the current-version prose still contains `1.3.3` and the usage history has no `v1.3.4` row. This is the documentation regression the new Skill must prevent.

- [ ] **Step 2: Set `VERSION` and README to 1.4.0**

Set `VERSION` to one line:

```text
1.4.0
```

Update README so its current behavior states:

```markdown
默认仍先尝试西瓜线路 1。交互模式下 MP4 直链交给 IDM，M3U8 交给 ffmpeg；密码后台计划任务统一使用 ffmpeg，避免桌面会话隔离。待下载清单写入 `local/待下载清单.csv`，整个 `local/` 目录只保存在本机。
```

Replace the generated-file table row with:

```markdown
| `local/待下载清单.csv` | 每次运行生成的缺失集清单，整个 `local/` 目录不进入 Git |
```

Set the current-version sentence to:

```markdown
当前版本 1.4.0，清单里在追 5 部动漫。版本记录在 [使用说明.md](使用说明.md) 文末。
```

- [ ] **Step 3: Update the usage guide paths and version history**

Change every current instruction that points to root `待下载清单.csv` so it points to `local/待下载清单.csv`. Update the file table to explain that `local/` contains local-only reports, guides, and generated lists and is ignored by Git.

Append these exact history rows after `v1.3.3`:

```markdown
| v1.3.4 | 修复下载流程误用未定义站点信息的问题，改为始终使用当前动漫条目的 `site_id`；加入可注入依赖的回归测试，避免取址和线路调用再次串错。 |
| v1.4.0 | 后台计划任务的 MP4 与 M3U8 下载统一改用 ffmpeg，交互模式保留 MP4 使用 IDM；新增 ffmpeg 失败后立即换线路和 `.part.mp4` 原子文件；日志改用上海时区并修正历史时间；本地报告、GitHub 教程和待下载清单集中到被 Git 忽略的 `local/`。 |
```

- [ ] **Step 4: Verify version and path consistency**

Run:

```powershell
$version=(Get-Content -Raw -Encoding UTF8 VERSION).Trim()
if ($version -ne '1.4.0') { throw "VERSION is $version" }
Select-String -Path README.md,'使用说明.md' -Pattern '当前版本 1\.3\.3|根目录.*待下载清单|`待下载清单\.csv`' -Encoding UTF8
Select-String -Path README.md,'使用说明.md' -Pattern '1\.4\.0|local/待下载清单\.csv|v1\.3\.4' -Encoding UTF8
```

Expected: the stale-current-path search prints nothing. The second search finds 1.4.0 and local CSV references in both documents and finds the new v1.3.4 history row in `使用说明.md`.

- [ ] **Step 5: Commit release documentation**

```powershell
git add VERSION README.md '使用说明.md'
git commit -m "docs: release version 1.4.0"
```

Expected: one documentation commit with the version file and both user-facing guides.

---

### Task 4: Create and Validate the Personal Maintenance Skill

**Files:**

- Create `C:\Users\15269\.codex\skills\maintaining-age-anime\SKILL.md`
- Create `C:\Users\15269\.codex\skills\maintaining-age-anime\agents\openai.yaml`

**Interfaces:**

- Consumes the project root, `VERSION`, README, `使用说明.md`, tests, `.gitignore`, and Git status.
- Produces a discoverable personal Skill triggered by AGE project maintenance, release, fixes, path changes, and commits.
- Produces a completion contract requiring synchronized version and path documentation.

- [ ] **Step 1: Capture the failing baseline without the new Skill**

Use the current repository evidence as the RED result and record it in the execution notes:

```text
Commit 0103a7b changed VERSION from 1.3.3 to 1.3.4, but README and 使用说明 remained at 1.3.3 and 使用说明 omitted the v1.3.4 history row.
```

Also run one fresh subagent without loading the new Skill using this exact prompt:

```text
You are finishing a behavior-changing fix in the AGE animation updater. VERSION is 1.3.4, README says current version 1.3.3, and 使用说明 history ends at v1.3.3. The code and tests pass and you are under time pressure to commit. List the files and checks required before declaring completion.
```

Expected RED: the response omits at least one required synchronization target among `VERSION`, README current version, and the `使用说明` version-history row. If it includes all three, retain commit `0103a7b` as the observed baseline failure and continue because the repository already demonstrates the omission.

- [ ] **Step 2: Read the Skill metadata reference and initialize the Skill**

Read:

```powershell
Get-Content -Raw -Encoding UTF8 'C:\Users\15269\.codex\skills\.system\skill-creator\references\openai_yaml.md'
```

Initialize with the bundled Python runtime:

```powershell
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  'C:\Users\15269\.codex\skills\.system\skill-creator\scripts\init_skill.py' `
  maintaining-age-anime `
  --path 'C:\Users\15269\.codex\skills' `
  --interface 'display_name=维护 AGE 动画项目' `
  --interface 'short_description=同步 AGE 项目的版本、文档、路径和提交边界' `
  --interface 'default_prompt=检查并完成 AGE 动画项目维护，确保版本、使用说明、测试和 Git 边界一致。'
```

Expected: the Skill directory, `SKILL.md`, and `agents/openai.yaml` are created with no placeholder resource directories.

- [ ] **Step 3: Replace the generated Skill body with the minimal completion contract**

Write exactly this content to `SKILL.md`:

```markdown
---
name: maintaining-age-anime
description: Use when modifying, fixing, reorganizing, releasing, or committing changes in the AGE animation auto-updater project, especially when behavior, paths, dependencies, or user instructions change.
---

# Maintaining AGE Anime

## Completion contract

Before declaring project work complete:

1. Read `VERSION` and inspect recent Git history to identify the actual current version.
2. For behavior, dependency, path, scheduling, or user-workflow changes, choose the next semantic version and update `VERSION`.
3. Keep these three version surfaces synchronized: `VERSION`, the README current-version sentence, and the `使用说明.md` version-history table.
4. Update README and `使用说明.md` whenever commands, file locations, dependencies, defaults, download modes, or scheduled-task behavior change.
5. Search for stale current-version text and old active paths. Preserve old numbers only in historical version rows and archived logs.
6. Run `tests/run-tests.js`, `git diff --check`, and inspect `git status --short --ignored`.
7. Confirm `local/` and `tools/ffmpeg/ffmpeg.exe` are ignored and no local artifact is staged.

## Required handoff

Report the final version, documentation files updated, test result, ignored-local-file check, and commit status.

## Common misses

| Miss | Required correction |
| --- | --- |
| `VERSION` changed but docs did not | Update README current version and add the matching `使用说明.md` history row |
| A path changed only in code | Update both user guides and search for the old active path |
| Tests pass but local files are staged | Remove them from the index and verify `.gitignore` |
```

- [ ] **Step 4: Validate the Skill structure**

Run:

```powershell
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  'C:\Users\15269\.codex\skills\.system\skill-creator\scripts\quick_validate.py' `
  'C:\Users\15269\.codex\skills\maintaining-age-anime'
```

Expected: validation exits 0 and reports the Skill as valid.

- [ ] **Step 5: Run GREEN verification with the Skill loaded**

Run a fresh subagent with this exact prompt and the new Skill attached:

```text
Use $maintaining-age-anime at C:\Users\15269\.codex\skills\maintaining-age-anime to finish a behavior-changing fix in the AGE animation updater. VERSION is 1.3.4, README says current version 1.3.3, 使用说明 history ends at v1.3.3, and code tests pass. List the files and checks required before declaring completion.
```

Expected GREEN: the response explicitly requires updating `VERSION`, the README current-version sentence, and the `使用说明.md` version-history row; it also requires tests, stale-path search, and ignored-local-file inspection.

- [ ] **Step 6: Inspect generated metadata**

Run:

```powershell
Get-Content -Raw -Encoding UTF8 'C:\Users\15269\.codex\skills\maintaining-age-anime\agents\openai.yaml'
```

Expected: display name, short description, and default prompt match the initialized values and contain no placeholders. The personal Skill is outside this repository and therefore has no project Git commit.

---

### Task 5: End-to-End Verification

**Files:**

- Verify all project and personal Skill files from Tasks 1 through 4.
- Do not create new tracked files.

**Interfaces:**

- Consumes the final project state and installed Skill.
- Produces evidence that runtime behavior, documentation, local-only storage, and the scheduled task remain correct.

- [ ] **Step 1: Run the complete offline verification suite**

Run:

```powershell
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check anime_updater.js
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests/run-tests.js
git diff --check
```

Expected: syntax exits 0, all ten tests pass, and `git diff --check` prints nothing.

- [ ] **Step 2: Run one real dry-run**

Use the required web-access workflow for this networked check, then run:

```powershell
& 'C:\Users\15269\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' anime_updater.js --dry-run
```

Expected: exit code 0, no download starts, and the last progress line reports `local\待下载清单.csv`.

- [ ] **Step 3: Verify local artifacts and Git exclusions**

Run:

```powershell
$required = @(
  'local\故障修复报告-2026-08-09.md',
  'local\GitHub使用教程.md',
  'local\待下载清单.csv'
)
$required | ForEach-Object { if (-not (Test-Path -LiteralPath $_)) { throw "Missing $_" } }
git check-ignore -v $required
if (git ls-files local) { throw 'A local file is tracked' }
git status --short --ignored
```

Expected: all files exist, all are ignored by `local/`, `git ls-files local` is empty, and no local file is staged.

- [ ] **Step 4: Verify versions and scheduled task path**

Run:

```powershell
Get-Content -Encoding UTF8 VERSION
Select-String -Path README.md,'使用说明.md' -Pattern '1\.4\.0|local/待下载清单\.csv|v1\.3\.4' -Encoding UTF8
schtasks.exe /Query /TN 'AGEAnimeUpdater' /V /FO LIST
```

Expected: version is 1.4.0, both guides contain the active local path and version information, and the task action still runs the root `anime_updater.js` with status Ready or its current non-error state.

- [ ] **Step 5: Verify final Git history and cleanliness**

Run:

```powershell
git log -5 --oneline
git status --short
```

Expected: the three implementation commits are present after the plan commit, and tracked working-tree status is empty. Do not push.
