# AniVault GitHub PR 完整练习教程

本教程使用普通 git clone，不使用 worktree。你会完整练习两轮流程。

1. 拉取项目
2. 创建文本文件
3. 创建分支、暂存、提交、推送
4. 在 GitHub 创建 PR、检查、审查、等待 CI、合并
5. 拉取合并后的 master
6. 删除文本文件并重复完整流程

## 一、准备干净目录

原目录 D:\\project_codex\\260814_animeinstall_auto 当前有运行日志、追更进度和设计文档删除记录。不要在原目录执行 git add .。

建议使用普通克隆目录。

```text
D:\\project_codex\\cangfan-pr-practice
```

检查目录是否存在。返回 False 才继续，返回 True 时换一个目录名称。

```powershell
$PracticeFolder = 'D:\\project_codex\\cangfan-pr-practice'
Test-Path -LiteralPath $PracticeFolder
```

## 二、命令解释

| 命令 | 作用 |
| --- | --- |
| Set-Location -LiteralPath 路径 | 进入目录，cd 是简写 |
| Get-Location | 查看当前目录 |
| Test-Path | 判断路径是否存在 |
| Get-Content 文件 | 读取文本文件 |
| notepad 文件 | 用记事本创建或编辑文件 |
| git status -sb | 查看分支和文件状态 |
| git switch master | 切换主分支 |
| git switch -c 分支名 | 创建并切换新分支 |
| git pull --ff-only origin master | 拉取远端 master，发现分叉时停止 |
| git add -- 文件 | 只暂存指定文件 |
| git diff --cached | 查看已暂存差异 |
| git commit -m 说明 | 创建本地提交 |
| git push -u origin 分支名 | 推送到 GitHub |
| git branch -d 分支名 | 删除已合并的本地分支 |

Git 的路线是 工作区 → git add → 暂存区 → git commit → 本地提交 → git push → GitHub。
git push 上传本地提交，git pull 下载远端提交。Pull Request 是 GitHub 上的合并请求，和 git pull 不是同一个操作。

## 三、克隆项目

```powershell
git clone https://github.com/heathfris/cangfan.git $PracticeFolder
Set-Location -LiteralPath $PracticeFolder
Get-Location
git status -sb
git branch --show-current
git remote -v
```

当前分支应为 master，状态类似 ## master...origin/master。

新克隆目录没有 node_modules，先安装并运行基线测试。

```powershell
pnpm install --frozen-lockfile
pnpm test
```

--frozen-lockfile 要求严格按照锁文件安装，避免自动改依赖版本。

## 四、第一轮新增文档

### 1. 创建分支

```powershell
git switch master
git pull --ff-only origin master
git status -sb
git switch -c codex/practice-add-text-file
git branch --show-current
```

### 2. 创建文件

```powershell
notepad .\\GIT_PR_PRACTICE.txt
```

输入下面一行并保存。

```text
这是我第一次完整练习 GitHub Pull Request 流程。
```

检查文件。

```powershell
Test-Path .\\GIT_PR_PRACTICE.txt
Get-Content .\\GIT_PR_PRACTICE.txt
git status --short
```

预期出现 ?? GIT_PR_PRACTICE.txt。?? 表示新文件还没有被 Git 跟踪。

### 3. 暂存、检查、测试、提交

```powershell
git add -- GIT_PR_PRACTICE.txt
git status --short
git diff --cached -- GIT_PR_PRACTICE.txt
git diff --cached --check
pnpm test
git diff --check
git status --short --ignored
git commit -m "docs: add GitHub PR practice file"
git log -1 --oneline
```

只要差异中出现其他文件，就先不要提交。取消暂存使用 git restore --staged -- 文件名。

### 4. 推送

```powershell
git push -u origin codex/practice-add-text-file
```

## 五、第一轮 GitHub 网页操作

打开 https://github.com/heathfris/cangfan。

点击 Compare & pull request。如果没有黄色提示条，进入 Pull requests，再点击 New pull request。

选择来源和目标。

```text
base: master
compare: codex/practice-add-text-file
```

base 是接收修改的目标分支，compare 是装着修改的来源分支。

PR 标题：docs: add GitHub PR practice file

PR 说明可以填写：

```markdown
## 修改内容

新增 GIT_PR_PRACTICE.txt，用于练习完整的 GitHub Pull Request 流程。

## 检查结果

- pnpm test 通过
- git diff --check 通过
- 本次只新增一个文本文件
```

创建后检查 Commits 和 Files changed。只能有一个提交，只能新增 GIT_PR_PRACTICE.txt，不能出现 content.json、PROGRESS.md、local 或 node_modules。

进入 Files changed，阅读差异，勾选 Viewed，点击 Review changes，选择 Comment，再点击 Submit review。

审查意见可以写：已检查提交范围和文件内容。本次只新增练习文本，测试和格式检查均已通过。

PR 作者不能批准自己的 PR，所以选择 Comment。协作者审查时才选择 Approve。

等待 CI 通过。PowerShell 也可以执行：

```powershell
gh pr checks --watch
```

全部通过后，在网页依次点击 Merge pull request、Confirm merge、Delete branch。

回到 PowerShell 同步合并结果：

```powershell
git switch master
git pull --ff-only origin master
Test-Path .\\GIT_PR_PRACTICE.txt
Get-Content .\\GIT_PR_PRACTICE.txt
git branch -d codex/practice-add-text-file
git fetch --prune origin
git status -sb
```

Test-Path 应返回 True。

## 六、第二轮删除文档

确认第一轮已经合并后执行：

```powershell
git switch master
git pull --ff-only origin master
Test-Path .\\GIT_PR_PRACTICE.txt
git status -sb
git switch -c codex/practice-remove-text-file
git rm -- GIT_PR_PRACTICE.txt
Test-Path .\\GIT_PR_PRACTICE.txt
git status --short
git diff --cached -- GIT_PR_PRACTICE.txt
git diff --cached --check
pnpm test
git diff --check
git status --short --ignored
git commit -m "docs: remove GitHub PR practice file"
git log -1 --oneline
git push -u origin codex/practice-remove-text-file
```

git rm 同时从工作区删除文件并暂存删除操作。预期状态是 False 和 D  GIT_PR_PRACTICE.txt。

## 七、第二轮 GitHub 网页操作

再次打开仓库并点击 Compare & pull request。

```text
base: master
compare: codex/practice-remove-text-file
```

标题：docs: remove GitHub PR practice file

说明可以写：删除第一轮练习创建的 GIT_PR_PRACTICE.txt。pnpm test 和 git diff --check 均已通过，本次只删除一个练习文本文件。

进入 Files changed，确认只删除 GIT_PR_PRACTICE.txt。勾选 Viewed，选择 Review changes、Comment，提交自审意见。

等待 CI 通过后，点击 Merge pull request、Confirm merge、Delete branch。

## 八、最终同步

```powershell
git switch master
git pull --ff-only origin master
git branch -d codex/practice-remove-text-file
git fetch --prune origin
git status -sb
Test-Path .\\GIT_PR_PRACTICE.txt
git log -5 --oneline
```

最终应看到 master 与 origin/master 一致，Test-Path 返回 False。GitHub 历史中会保留两个 PR 和两个提交。

## 九、常见错误

- 不要在现场目录执行 git add .，始终使用 git add -- 指定文件。
- git pull --ff-only 报错时说明本地和远端分叉，先不要强制重置。
- PR 出现其他文件时不要合并，回本地检查 git status --short 和 git diff --cached --name-only。
- GitHub 没有黄色提示条时，进入 Pull requests → New pull request 手动创建。
- PR 作者无法 Approve 属于正常限制，作者使用 Comment。

官方参考：

- https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository
- https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request
- https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request
