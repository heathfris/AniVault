# 番仓内置 mpv 观看同步模块：技术设计

> 状态：0.11.1实现完成；2026-09-01 已安装到真实mpv并启用，部署哈希匹配。自动测试与停用态Lua加载已验证；真实长视频已有45%时长和90%位置采样，但因当时未配置 `{watched}` 尚未形成成功改名的端到端记录。初版日期：2026-08-29；实现日期：2026-09-01；规则调整：2026-09-02。

## 目标与不可变语义

- 只处理 `D:\idm下载` 下、能够由当前动漫的 `folder_name` 模板唯一匹配的本地目录。
- “看完”必须同时满足：有效真实播放时间 `eligible_seconds >= duration × 0.45`，以及历史最大播放位置 `max_time_pos >= duration × 0.9`。
- 倍速不放大真实时间；seek 可以更新最大播放位置，但寻址过程不增加真实时间。两道门槛都满足前绝不达标。
- 同一文件可跨会话累计；文件路径、大小或修改时间变化后视为新文件。
- 每部动漫以最后一个达到阈值的文件集数为准，允许前缀倒退。
- 播放期间不改名；正常关闭 mpv 后才尝试。崩溃时不改名，但最多损失约 10 秒尚未落盘的累计值。
- `folder_name` 只有包含一次 `{watched}` 才选择加入观看改名；缺少该占位符、目录匹配为零或不唯一时都不改名。
- 用户从番仓面板选择是否安装、启用、停用或卸载；日常不要求手动运行PowerShell。
- 这是番仓内置的单个可选集成模块，不建设通用插件框架、插件市场或动态加载系统。

## 三条路线比较

| 维度 | 1. Lua 关闭时直接改名 | 2. Lua 计时 + detached Node 助手 | 3. Lua 写标记 + 番仓下次运行 |
|---|---|---|---|
| 真实播放计时 | 可做 | 可做 | 可做 |
| 跨会话恢复 | Lua 自己维护 | Lua 追加事件，Node 汇总 | 标记文件汇总 |
| 文件夹占用 | shutdown 内仍可能占用 | 助手等 mpv 退出后改名 | 下次运行时通常已释放 |
| 连续播放列表 | shutdown 前改名有旧路径风险 | 整个会话结束后改，安全 | 安全 |
| 崩溃 | 容易丢状态 | 追加日志可恢复 | 标记可恢复 |
| 目标冲突 | 需重写保护 | 复用 `safeRenameFolder()` | 复用主流程，但耦合调度 |
| 可测试性 | Lua/Windows 文件系统难隔离 | 计时和改名分层，Node 易测 | 易测但反馈延迟 |
| 项目搬家 | 脚本逻辑重复 | 在番仓面板重新安装以刷新项目路径 | 依赖计划任务路径 |
| 生效时间 | 关闭时 | 关闭后数秒 | 最晚到下一次番仓运行 |
| 安装 | 手工复制一份Lua脚本 | 番仓面板部署Lua并写入Node助手路径 | 复制Lua并修改番仓启动流程 |
| 回滚 | 删除 Lua | 删除 Lua，保留项目源码 | 删除 Lua 并清标记 |

**唯一推荐：路线 2。** Lua 擅长读取 mpv 事件，Node 助手复用番仓导出的模板匹配、目录生成与安全改名入口；两者之间只传 JSONL 事件。路线 1 会把番仓规则复制进 Lua，且 shutdown 回调不能证明目录锁已释放。路线 3 虽稳，但把“关闭后自动更新”降级成“下次计划任务才更新”。

## 推荐架构

### 模块归属与控制层级

面板新增一张固定的“mpv观看同步”功能卡片。它看起来像插件，但内部是番仓已知的一个可选模块，沿用现有 `electron/main.js → electron/preload.js → renderer/renderer.js` IPC链路，不扫描第三方插件目录。

控制分三层：

1. **是否安装**：决定是否把Lua与配置副本部署到mpv的 `portable_config`。
2. **是否启用**：已安装后通过项目本地 `enabled.flag` 启停；停用不删除文件，Lua读取到关闭状态后不注册计时器和事件。
3. **单部动漫是否参与**：只有 `folder_name` 恰好包含一个 `{watched}` 的动漫参与自动改名。

安装完成后默认停用，用户明确打开总开关后才开始记录。卸载只移除部署副本，不删除项目内源码、累计状态或日志。

### 面板状态机

| 状态 | 判定 | 可用操作 |
|---|---|---|
| 未安装 | 目标Lua或配置不存在 | 安装、选择mpv目录 |
| 已安装·已停用 | 部署文件哈希匹配，`enabled.flag`为`no` | 启用、卸载、检查 |
| 已安装·已启用 | 部署文件哈希匹配，`enabled.flag`为`yes` | 停用、卸载、检查 |
| 需要更新 | 部署文件仍是番仓上次安装的版本，但与项目当前源码哈希不同 | 更新、停用、卸载 |
| 外部改动/路径异常 | 文件哈希不是番仓记录值，或mpv目录不可访问 | 只检查并显示原因；不覆盖、不删除 |

“检查状态”只读目标文件、配置和安装记录，不启动mpv、不迁移目录。安装、更新和卸载必须在面板显示目标绝对路径与结果；失败只返回错误，不留下“已安装”的假状态。

### 管理器与IPC固定契约

`src/mpv-watched-prefix-manager.js` 导出以下Promise函数，所有函数返回同一结构，不抛出可预期的路径、权限或状态错误：

```js
getStatus({ mpvRoot })
install({ mpvRoot })
update()
setEnabled({ enabled })
uninstall()
```

统一返回：

```js
{
  ok: true,
  status: {
    state: 'not-installed|disabled|enabled|update-available|external-change|path-error',
    enabled: false,
    mpvRoot: 'F:\\Backend\\mpv.lite',
    targets: {
      script: '...\\portable_config\\scripts\\anivault-watched.lua',
      config: '...\\portable_config\\script-opts\\anivault-watched.conf'
    },
    reason: null
  },
  error: null
}
```

失败时 `ok=false`、`error` 为可显示文字，`status`仍返回操作后的真实状态。Electron固定使用：

| IPC | preload方法 | 管理器调用 |
|---|---|---|
| `mpv-sync:status` | `mpvSyncStatus(mpvRoot)` | `getStatus({mpvRoot})` |
| `mpv-sync:install` | `mpvSyncInstall(mpvRoot)` | `install({mpvRoot})` |
| `mpv-sync:update` | `mpvSyncUpdate()` | `update()` |
| `mpv-sync:set-enabled` | `mpvSyncSetEnabled(enabled)` | `setEnabled({enabled})` |
| `mpv-sync:uninstall` | `mpvSyncUninstall()` | `uninstall()` |

Renderer只根据返回的 `status.state` 控制按钮，不自行检查文件系统或推断安装状态。

本次实现新增：

| 文件 | 职责 |
|---|---|
| `integrations/mpv-watched-prefix/anivault-watched.lua` | 监听 mpv、累计真实播放秒数、追加会话事件、关闭时启动助手 |
| `integrations/mpv-watched-prefix/apply-watched-prefix.js` | 汇总跨会话时间、验证路径和集数、等待 mpv 退出、改名前缀 |
| `integrations/mpv-watched-prefix/mpv-watched-prefix.conf.example` | 保存可审查的配置样例，不把本机绝对路径硬编码进Lua源码 |
| `integrations/mpv-watched-prefix/tests/watched-prefix.test.js` | 覆盖计时汇总、最后事件优先、目录冲突和失败保护 |
| `src/mpv-watched-prefix-manager.js` | 提供只读状态检查，以及安装、更新、启用、停用、卸载；使用Node标准库，不依赖PowerShell |
| `src/folder-rename-lock.js` | 番仓和观看助手共用的原子改名锁及陈旧锁保留策略 |

已完成的现有代码改动面：

- `anime_updater.js`：扩展现有模板入口以支持 `{watched}`，新增并导出同源的模板匹配函数；`findFolder()`、下载后的目录生成和mpv助手全部调用这两个入口。
- `src/config/validator.js`：仅允许 `folder_name` 使用至多一次 `{watched}`；`file_name` 继续保持当前占位符集合。
- `renderer/renderer.js`、`README.md`、`使用说明.md`：只补占位符提示和启用说明，不把字符串模板改成新配置对象。
- `electron/main.js`、`electron/preload.js`、`renderer/index.html`、`renderer/styles.css`：按现有IPC模式接入固定功能卡片和五个操作，不引入通用插件注册表。
- 现有测试与新增专项测试：锁定旧模板兼容、唯一匹配、保留自定义文字及并发失败保护。

运行数据只写入已忽略的 `local/mpv-watched-prefix/`：

- `session-<pid>-<启动时间>.jsonl`：每 10 秒追加累计增量，最后一行不完整时忽略。
- `state.json`：Node成功汇总后的余量、稳定文件身份和每个会话已提交的最大seq。
- `folder-rename.lock`：番仓和所有mpv助手共用；抢不到锁就不改，事件留待下次。
- `watched-prefix.log`：时间、原目录、目标目录、结果和失败原因，不记录视频内容。
- `enabled.flag`：唯一内容为 `yes` 或 `no`，是总开关的唯一事实来源；默认 `no`。
- `install-state.json`：记录目标mpv目录和上次部署文件哈希，仅供状态检查与安全更新/卸载，不重复保存enabled。
- `install-transaction.json`：安装、更新或卸载未完成时的恢复日志；操作提交后删除。

`install-state.json` 固定为版本1：

```json
{
  "v": 1,
  "mpv_root": "F:\\Backend\\mpv.lite",
  "files": {
    "script": {"relative_path":"portable_config\\scripts\\anivault-watched.lua","sha256":"..."},
    "config": {"relative_path":"portable_config\\script-opts\\anivault-watched.conf","sha256":"..."}
  },
  "installed_at": "2026-09-01T13:00:00+08:00"
}
```

启停只原子替换项目本地 `enabled.flag`，不修改已部署Lua或配置，因此不会制造“配置哈希变化等于外部改动”的冲突。Lua从部署配置取得项目路径，再读取该标志；读不到、内容非法或项目搬家时一律按停用处理。

事件示意：

```json
{"v":1,"seq":7,"path":"D:\\idm下载\\13_片名1-14 [1080P]\\片名 第14集.mp4","size":123,"mtime":1787990000,"duration":1440.0,"eligible_delta":10.0,"time_pos":1310.0,"at":"2026-08-29T18:00:00+08:00"}
```

原始事件保留完整路径用于审计，但跨会话稳定身份改为 `anime配置键 + 动漫目录内相对视频路径 + size + mtime`。父目录只改变 `{watched}` 或 `{end}` 时身份不变；文件名、大小或修改时间变化时旧记录失效。每个身份持久化 `eligible_seconds` 与 `max_time_pos`；事件ID固定为 `session文件名 + seq`。

Node首次处理事件时用当前 `content.json` 和folder_name唯一匹配动漫。若事件中的旧父目录已不存在，则在该动漫当前唯一目录内按“相对视频路径+size+mtime”寻找候选：恰好一个才重新绑定，0个或多个都不合并。Lua每个会话只记录本次增量，不负责恢复历史；Node在正常关闭后合并历史，因此目录迁移规则只实现一处。

`state.json`为每个session保存 `committed_seq`；seq小于等于该值的事件重复读取时忽略。若目录已改成事件目标但提交记录尚未落盘，助手将其视为上次改名已成功，只补写提交状态，不再次改名。

## folder_name 唯一契约

`folder_name` 继续是一个字符串。现有 `{name}`、`{start}`、`{end}`、`{ep}` 保持原义，新增 `{watched}` 表示看到的集数；模板中的其他普通文字原样保留，因此已经能表达前缀、名称、后缀和自定义文字：

```json
"folder_name": "{watched}_{name}{start}-{end} [1080P]"
```

模板生成与匹配必须来自同一入口：生成时将变量替换成文字；匹配时转义全部普通文字，`{name}` 必须精确等于配置标题，数值占位符只接受非负整数，其中 `{watched}` 是唯一需要捕获的值。不得在mpv助手中另写一套目录正则。

- `{watched}` 出现0次：番仓继续按模板下载和改下载末集，但mpv助手不修改该目录。
- `{watched}` 出现1次：启用观看改名；新建目录时默认值为0，已有目录从模板匹配结果取得当前值。
- `{watched}` 出现2次以上：配置校验失败，番仓和mpv助手都不改目录。
- 同一目录匹配多个动漫，或同一动漫匹配0个/多个目录：视为歧义，记录原因，不猜测、不改名。

番仓下载成功时用“当前匹配结果 + 新end”生成目标名，只变化 `{end}`；mpv达标时用“当前匹配结果 + 新watched”生成目标名，只变化 `{watched}`。两者都必须逐字保留name、start以及模板中的空格、括号、清晰度等自定义文字。

## 状态机

1. **忽略**：没有本地绝对路径、路径不在下载根目录、父目录不能由一个含单个 `{watched}` 的模板唯一匹配、未知或非正数时长、文件信息不可读，均只记日志。
2. **载入**：`file-loaded` 后读取 `path`、`duration`、`time-pos`、`utils.file_info()`，只创建本会话计数器；历史累计由Node关闭助手统一合并，避免Lua与Node各实现一套路径迁移规则。
3. **采样位置**：建议每1秒读取一次 `time-pos`，只要是有限非负值就执行 `max_time_pos = max(max_time_pos, time-pos)`。seek可提高此值，但不触碰有效时长。
4. **累计时长**：周期计时器用 `mp.get_time()` 算真实时间差。仅当 `pause=false`、`core-idle=false`、`paused-for-cache=false`、`seeking=false` 时计入 `eligible_seconds`；任一属性变化就结算此前合格区间并重置采样起点。跨状态间隔不计，单次差值上限2秒，避免系统睡眠被算入。
5. **落盘**：每累计10秒或收到 `end-file` 时追加包含时长增量和当前位置的JSONL；切集只结束当前记录，不改目录。最后一行损坏时忽略该行。
6. **达标**：Node按稳定身份汇总历史状态和所有未提交记录。只有 `eligible_seconds >= duration × 0.45` 且 `max_time_pos >= duration × 0.9` 才生成合格事件。生成后从有效时长扣除一个时长阈值并把最大位置重置为0，使同一文件再次达标时也必须重新通过两道门槛。
7. **关闭**：`shutdown` 先冲刷余量，再用 `utils.subprocess_detached` 启动Node，传项目根目录、mpv PID和会话文件；Lua不等待结果。崩溃只留下可恢复记录，不触发改名。
8. **锁内复核**：Node 等PID消失后取得番仓与mpv共用的 `local/folder-rename.lock`，重新读取 `content.json` 和下载根目录；锁由原子创建获得，拿不到就保留事件退出。
9. **改名**：按每部动漫最后一条合格事件处理，通过共用模板入口重新确认恰好一个目录、集数位于start..end、原名未变化。只替换watched变量后生成目标名。
10. **提交结果**：目标已存在、配置变化、匹配歧义或改名失败时绝不覆盖，记录失败并保留事件；成功或确认目标已经是预期名称后，原子写state与committed_seq，再释放锁。

## 判定与改名数据例

以下视频时长均为20分钟，时长门槛为9分钟，位置门槛为18分钟：

1. 1倍速有效播放9分钟，最大位置达到18分钟：两项都满足，生成达标事件。
2. 2倍速从头完整看完，现实约经过10分钟：两项满足，生成达标事件。
3. seek到19分钟，只实际播放2分钟：位置满足、时长不足，不达标。
4. 反复播放结尾片段，累计有效时间达到9分钟且最大位置超过18分钟：会达标。这仍无法证明看过不同画面，若要证明必须记录区间覆盖率，本轮不引入。

模板为 `{watched}_{name}{start}-{end} [1080P]` 时，第14集达标产生变量 `{watched:14,name:"片名",start:1,end:14}`。正常关闭后：

```text
13_片名1-14 [1080P] → 14_片名1-14 [1080P]
```

只有watched变化，空格和 `[1080P]` 原样保留。

### 先看8，再看3

同一动漫第8集先同时满足45%时长和90%位置，随后第3集也同时满足。两条合格事件顺序为8、3；关闭后每个目录只取最后一条，因此无论原前缀是多少，目标前缀为 `3_`。这不是取最大值。

## 边界处理

| 情况 | 处理 |
|---|---|
| 暂停、缓冲、拖动 | 不累计对应时间；seek可以更新最大位置，拖动前后正常播放仍累计 |
| 2倍速 | 按真实经过秒数累计，不乘2；完整看一遍通常可达到45%时长和90%位置 |
| 重复播放同一片段 | 会累计；若最大位置也到90%，仍可能达标 |
| 未知时长、网络流 | 不追踪、不改名 |
| mpv崩溃/断电 | 不改名；已写JSONL的增量下次恢复 |
| 多部动漫 | 按父目录分别选择最后合格事件 |
| 同一动漫多次达标 | 最后达标的集数覆盖先前集数，可升可降 |
| 不含`{watched}` | 该动漫不启用观看改名，番仓其他功能不受影响 |
| 模板或目录匹配歧义 | 不猜测、不改名，记录所有候选名称 |
| 目录已存在 | 不合并、不覆盖，记录失败 |
| 番仓与多mpv实例 | 共用 `folder-rename.lock` 串行化；失败者保留事件 |
| 项目或mpv搬家 | 失效并记日志，在番仓面板重新选择路径并安装 |
| 面板总开关关闭 | Lua不注册监听，不采样、不落盘、不启动Node助手 |
| 部署文件被外部修改 | 显示“外部改动”，禁止静默更新或卸载 |

## 并发、迁移与失败恢复

- 锁的临界区必须包含“重读配置 → 重新扫描 → 生成目标名 → 检查目标不存在 → rename”，不能只锁最后一步。番仓下载改名和mpv观看改名使用同一路径、同一协议。
- 锁通过Node `open(..., 'wx')`原子创建，内容固定为版本、PID、进程启动时间、创建时间和操作者。已存在时按以下顺序处理：
  1. PID仍存活且进程启动时间一致：返回busy，绝不抢占。
  2. PID不存在且锁龄不足10分钟：返回busy，防止进程状态瞬时误判。
  3. PID不存在且锁龄达到10分钟：将锁原子改名为 `folder-rename.lock.stale-<时间戳>`，然后只重试获取一次；不直接删除证据。
  4. PID状态无法读取、启动时间不一致但无法证明旧进程已死、JSON损坏或改名失败：记录BLOCKED，不改目录。
- stale备份默认保留，面板“检查状态”显示其路径；清理不属于自动改名流程。这样崩溃锁能自动恢复，仍不会在所有者身份不明时强占。
- 旧目录迁移先运行现有dry-run核对配置和冲突，再由用户手动改成模板可唯一匹配的名称；检测到旧目录时主程序拒绝自动迁移，安装过程也不批量改名。
- 失败事件保留到下一次正常关闭或番仓运行。恢复时再次走完整锁内复核；目录仅发生受控父目录改名时按稳定身份重新绑定，文件名、大小、mtime或动漫唯一匹配变化后旧事件失效并归档。

## 最小测试矩阵

1. 100秒视频四象限：时长/位置分别为89/89、90/89、89/90、90/90，只有最后一组达标。
2. 暂停、缓冲、seek和睡眠不增加时长；seek到95只改变最大位置；2倍速完整播放仍按现实秒数计。
3. 两次会话45秒+45秒且最大位置90秒时达标；受控父目录改名后仍合并，文件名、大小或mtime变化时不合并；候选不唯一时拒绝。
4. `{watched}_{name}{start}-{end} [1080P]` 能捕获13并生成14，只有watched变化；无watched模板不改。
5. 番仓把end从14更新到15时保留watched=13；mpv把watched从13改为3时保留end=15和全部文字。
6. 模板含两个watched、0匹配、多匹配、多动漫匹配、目标存在、目录越界、锁冲突全部不改且有日志。
7. 顺序8→3最终watched=3；两部动漫互不影响；同一文件第二次达标前必须重新满足两道门槛。
8. 管理器五种状态和五个IPC返回固定结构；安装后默认停用，启停只改enabled.flag，不改变部署哈希，重复操作保持幂等。
9. 模拟第二个文件复制失败和各事务阶段崩溃：目标文件、install-state和enabled.flag恢复到操作前；篡改已部署Lua后，更新和卸载都拒绝。
10. 锁测试覆盖活PID、死PID不足10分钟、死PID达到10分钟、PID状态未知和损坏JSON；只有第三种把锁改名为stale备份并重试一次。
11. 同一session重复读取相同seq不重复累计；改名成功但提交前崩溃时，下次识别目标已就位并只补提交状态。
12. 停用标志、缺失标志和非法标志下Lua都不得注册计时器、mpv事件或启动Node助手；明确写yes后才注册。
13. 反向验证：先让阈值、模板唯一性、陈旧锁和安装回滚测试失败，再实现到全绿；原有测试数和通过结果不得减少。

## 资源分析

- **计时复杂度**：每个采样点只读取固定数量的mpv属性并更新两个数字，为O(1)时间和O(1)活跃状态；不记录每一帧，也不建立播放区间位图。
- **采样频率**：建议1秒一次；属性变化时额外结算状态。实际CPU百分比尚未实测，不能承诺具体数字。
- **落盘频率**：建议每10秒及`end-file`、`shutdown`落盘；最后一行可丢弃，预期崩溃损失上限约10秒。
- **目录扫描**：只扫描 `D:\idm下载` 的直接子目录，发生在番仓运行、助手关闭处理或迁移dry-run时；播放计时器不扫描磁盘、不使用常驻文件监控。
- **后台助手**：Node只在正常关闭后短暂运行，不作为常驻服务；无任务时退出。
- **日志轮转**：复用项目现有按行轮转思路，建议最多保留2000行并写轮转标记；实际磁盘增长在实现后用长时播放测试测量。

## 安装、启停与回滚边界

主要入口是番仓面板，不要求用户运行独立安装脚本：

1. **安装**：管理器验证mpv目录、项目源码和Node运行时，显示将写入的绝对路径；目标无冲突时部署Lua和固定配置，记录部署哈希，并原子写本地 `enabled.flag=no`。安装不启动mpv、不迁移旧目录。
2. **启用**：只把项目本地 `enabled.flag` 原子更新为 `yes`；下次启动mpv生效。每部动漫仍需在folder_name中明确加入一个 `{watched}`。
3. **停用**：只把 `enabled.flag` 原子更新为 `no`；下次启动mpv后Lua立即退出，不采样、不启动助手。源码、部署文件、状态和日志保留，便于再次启用。
4. **更新**：只有当前部署哈希仍等于 `install-state.json` 记录的上次哈希时才备份并替换；检测到用户或第三方改动就拒绝覆盖。
5. **卸载**：只删除路径位于已确认mpv目录内、且哈希仍匹配番仓部署记录的Lua和模块配置；不删除其他mpv脚本，不迁移或改回动漫目录，不清累计状态和日志。

部署目标固定为：

```text
<mpvRoot>\portable_config\scripts\anivault-watched.lua
<mpvRoot>\portable_config\script-opts\anivault-watched.conf
```

配置仅包含 `project_root`、`node_path`、`state_dir`，不包含enabled；路径按mpv script-opts格式转义。安装时要求 `mpv.exe`、`portable_config`存在且两个目标的规范化绝对路径都位于所选mpvRoot内。目标已存在但没有匹配的install-state时视为外部冲突，不覆盖。

安装、更新、卸载使用同一事务协议：

1. 在目标同目录写临时文件并计算SHA-256；更新/卸载前把当前受管文件复制到 `local/mpv-watched-prefix/backup/<事务ID>/`。
2. 原子写 `install-transaction.json`，记录操作类型、目标、原哈希、目标哈希、备份路径和阶段 `prepared`。
3. 逐个原子替换或移除目标，每完成一个就原子更新事务阶段；全部成功后原子写 `install-state.json`，最后删除事务文件。
4. 任一步失败立即按备份逆序恢复；如果进程崩溃，下一次任何管理器调用先读取事务文件并执行同一恢复，再返回真实状态。
5. 恢复完成前禁止新的安装操作；无法恢复时返回 `external-change` 并保留事务与备份，不继续覆盖。

旧目录启用新模板前仍必须先dry-run预览，再由用户明确执行迁移。

不单独建设PowerShell安装器、通用插件清单或第三方插件API；只有未来出现第二个独立集成模块且重复代码已被验证时，才评估抽象公共管理层。

## 关键结论与复现证据（5条）

1. **mpv Lua 是正确扩展点。** 本机 `portable_config/scripts` 已加载脚本；官方手册推荐用户脚本增强CLI播放器。复现：查看该目录并运行 `mpv --version`。
2. **45%时长+90%位置可由固定状态表达。** 官方提供 `time-pos`、`duration`、`mp.get_time()`、周期计时器，以及暂停、核心空闲、缓冲、寻址属性。复现：`mpv --list-properties` 搜索这些名称。
3. **关闭后独立处理有官方能力支撑。** 官方说明 `shutdown` 会通知脚本，`utils.subprocess_detached` 启动的进程脱离mpv控制。复现：搜索本机 `uosc/main.lua` 的相同调用。
4. **folder_name已使用共享入口。** `anime_updater.js` 的 `applyTemplate()`、`matchFolderTemplate()`、`resolveFolderName()`、`findFolder()` 和 `safeRenameFolder()`构成生成、匹配、查找、改名链，Node助手直接复用它们。复现：全文搜索这些导出名以及助手的`require('../../anime_updater.js')`。
5. **文件访问时间不能当观看证据。** 它不能区分播放器、预览或其他读取；实现完全不读取atime。复现：全文搜索实现和测试，观看判定只来自JSONL中的有效时长与播放位置。

## 资料

- mpv 官方参考手册（Lua scripting、Events、Properties、subprocess），https://mpv.io/manual/master/ ，查阅于2026-08-29。
- 本机 mpv v0.40.0-142 与 `F:\Backend\mpv.lite\portable_config\scripts\uosc\main.lua`，核验于2026-08-29。
- 本仓库 `anime_updater.js` 与 `content.json`，核验于2026-08-29。
