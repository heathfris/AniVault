# AniVault 安全与质量修复设计

## 目标

修复审查确认的下载并发、跨进程写入竞争、Portable mpv 同步路径问题，并补齐低成本的输入、渲染和网络健壮性防护；保持现有用户数据格式和运行流程兼容。

## 设计

### 下载进程

`callFfmpeg` 和 `callAria2` 改为 Promise 包装的异步 `spawn`。子进程退出后检查退出码，再执行现有的临时文件重命名；下载完成判断继续使用 `waitForFile`。`runPool` 接口保持不变，因此现有并发调度和失败回退逻辑不需要重写。

### 文件写入协调

面板和 updater 对 `content.json`、CSV 的写操作共享同一目录下的原子锁。锁只负责跨进程互斥，现有原子写继续保留。获得锁失败时返回可识别的 busy 错误，不覆盖对方刚写入的数据。

### Portable mpv

mpv 配置显式记录实际的 `content.json`、下载目录和状态目录。Lua helper 通过参数读取这些路径。Node 启动继续复用现有 runner 的 `ELECTRON_RUN_AS_NODE=1` 机制，避免把 Electron 可执行文件当作普通 Node 进程启动。

### 低风险加固

动态匹配站点 base URL；CSV 使用带引号和转义的解析/写出；文件名拒绝点目录、空白和控制字符；数字字段统一 HTML 转义；增加 CSP、阻止外部窗口和导航；按实际扩展名生成线路临时文件。

## 范围外

本轮不重构日志轮转、不改变 IDM 引擎策略、不扩展多站点、不重做安装包体系。

## 验收

- 新增回归测试先在旧实现上失败，再在修复后通过。
- `pnpm test`、`pnpm run selftest`、`pnpm run smoke` 和 `git diff --check` 通过。
- Portable 配置不再把用户数据路径指向安装目录，mpv helper 能读取实际配置和下载目录。
- `content.json`、`PROGRESS.md`、`BLOCKED.md` 等用户现场数据不被修改或删除。
