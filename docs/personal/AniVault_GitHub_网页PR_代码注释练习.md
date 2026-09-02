# AniVault 通过 GitHub 网页完成代码注释 PR

这次练习专门使用 GitHub 网页，不要求把整个仓库克隆到本地，也不要求使用 Git、PowerShell 或 pnpm 命令。

练习目标是只修改一个现有代码文件，在代码中增加一段有意义的注释，然后完成提交、创建 PR、查看变更、审查和合并。

## 先理解你要做什么

你要修改的文件是：

```text
src/runner.js
```

建议把注释放在 `createRunner` 函数中，靠近下面这段代码：

```js
const spec = spawnSpec(scriptPath, args, extraEnv);
child = spawn(spec.command, spec.args, spec.options);
writeLock(lockPath, child.pid);
```

注释需要说明两件事：

1. 这里使用 Electron 的 Node 进程启动更新脚本
2. 写入进程锁是为了避免同时启动两个更新任务

可以使用下面这段英文注释，也可以自己用准确的中文表达：

```js
// Start the updater as a child process and record its PID so concurrent runs can be blocked.
```

这次只增加注释，不要修改代码逻辑、变量名、缩进或其他文件。

## 第一部分，在 GitHub 网页上编辑指定文件

1. 打开仓库页面

   `https://github.com/heathfris/cangfan`

2. 点击上方的 `Code` 或文件列表中的 `src` 目录。

3. 点击 `runner.js`，确认页面显示的是 `src/runner.js`。

4. 点击文件右上角的铅笔图标 `Edit this file`。

5. 在编辑器中找到 `createRunner` 函数里的启动代码。

6. 在 `const spec = spawnSpec(...)` 前面增加注释。

7. 向下滚动到 `Commit changes` 区域。

8. 提交说明填写：

   ```text
   docs: explain updater process locking
   ```

9. 选择 `Create a new branch for this commit and start a pull request`。

10. 分支名可以填写：

    ```text
    codex/web-comment-pr
    ```

11. 点击 `Propose changes`。

这里提交的只有当前正在编辑的 `src/runner.js`，不会把整个仓库重新上传一遍。GitHub 会在仓库中创建一个新分支，并把这一次网页编辑保存成一个提交。

## 第二部分，创建 Pull Request

提交后 GitHub 通常会显示 `Compare & pull request` 按钮。点击它。

确认两个分支的方向：

```text
base repository    heathfris/cangfan
base branch        master
compare branch     codex/web-comment-pr
```

PR 标题填写：

```text
docs: explain updater process locking
```

PR 描述可以填写：

```text
为 src/runner.js 中的更新进程启动和进程锁补充说明性注释。

本次只修改一个代码文件，不改变运行逻辑。
```

确认 `Files changed` 中只有：

```text
src/runner.js
```

如果看到 `PROGRESS.md`、`content.json` 或其他文件，不要继续合并，先检查是否选错了分支或编辑了错误的文件。

点击 `Create pull request` 创建 PR。

## 第三部分，在网页上审查自己的 PR

打开 PR 的 `Files changed` 标签，逐行确认：

- 只改了 `src/runner.js`
- 只增加了注释
- 注释描述的是启动子进程和写入进程锁
- 没有改动代码执行顺序
- 没有混入运行日志或个人文件

你可以点击具体代码行旁边的加号，留下审查评论，例如：

```text
The comment explains both the child process and PID lock clearly.
```

然后点击 `Review changes`。

如果这是你自己创建的 PR，通常不能用自己的账号提交有效的 `Approve`。可以选择 `Comment`，把这一步作为自检记录。真正的团队审查通常由另一位协作者完成。

## 第四部分，合并 PR

确认以下内容后再合并：

- `Files changed` 只有一个文件
- 注释内容准确
- Checks 没有失败
- 没有冲突

在 PR 的 `Conversation` 页面点击：

```text
Merge pull request
Confirm merge
```

合并后点击 `Delete branch`，删除远程练习分支。

## 第五部分，确认结果

返回仓库的 `master` 分支，打开 `src/runner.js`，确认注释已经出现在主分支中。

这就完成了：

```text
网页编辑一个文件
    ↓
创建新分支
    ↓
生成提交
    ↓
创建 PR
    ↓
查看 Files changed
    ↓
审查
    ↓
合并到 master
```

## 这次网页流程和命令行流程的区别

GitHub 网页适合小范围修改，例如文档、注释和简单配置。它可以只提交当前文件，也可以直接创建分支和 PR。

命令行适合需要本地运行测试、启动软件、检查多个文件和处理复杂冲突的修改。网页编辑完成后，GitHub Actions 也可能自动运行项目配置的检查，但这取决于仓库是否配置了工作流。

实际项目通常混合使用。代码修改在本地完成，PR 审查和合并在 GitHub 网页完成。小改动则可以直接在 GitHub 网页完成全部流程。

## GitHub 网页上几个按钮的含义

| 按钮 | 作用 |
| --- | --- |
| `Code` | 查看克隆地址和在线开发选项 |
| 铅笔图标 | 在线编辑当前文件 |
| `Commit changes` | 保存一次提交 |
| `Create a new branch` | 将修改放到新分支 |
| `Compare & pull request` | 根据分支差异创建 PR |
| `Files changed` | 查看文件差异 |
| `Review changes` | 提交审查意见 |
| `Merge pull request` | 将 PR 分支合并到目标分支 |
| `Delete branch` | 删除已合并的远程分支 |

## 官方参考

- Pull requests 简介  
  https://docs.github.com/en/pull-requests/get-started/about-pull-requests
- 审查 Pull Request  
  https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request
- 合并 Pull Request  
  https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request

