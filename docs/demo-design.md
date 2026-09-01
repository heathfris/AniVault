# 番仓 AniVault Demo 设计（0.1.0）

> 历史设计快照：记录 0.1.0 Demo 的原始范围，不代表当前 0.10.2 功能。当前能力、命令与版本以根目录 `README.md`、`使用说明.md` 和 `AGENTS.md` 为准。

## 目标

把原 AGE 自动追更脚本升级为可分发桌面软件的第一步：一个能读、改、存 `content.json` 的 Electron 配置面板。原仓库作为基线只读，新项目独立成库。

## 布局

- 左栏「全局设置」：`fetch_time`、`defaults.max_download`、`defaults.auto_repair`、`defaults.auto_close_idm`
- 右栏「追番清单」：每部番一张卡片，可增删、可改片名，卡片内逐字段编辑
  - `site_id`、`update_time`、`downloaded_start`、`downloaded_end`、`site_latest`、`folder_name`、`file_name`
- 底部：保存 / 重新载入 / 保存结果与校验错误提示

## 字段清单与校验规则

| 字段 | 规则 |
| --- | --- |
| `fetch_time` | 必须 `HH:MM` |
| `defaults.max_download` | 非负整数 |
| `defaults.auto_repair` / `auto_close_idm` | 必须布尔 |
| `site_id` | 正整数，可空 |
| `update_time` | `HH:MM`，可空 |
| `downloaded_start` / `downloaded_end` / `site_latest` | 非负整数，可空 |
| `folder_name` / `file_name` | 只允许 `{name}{ep}{start}{end}` 占位符；不含 `\/:*?"<>|`，可空 |
| 未知字段 | 原样保留，不报错 |

## 数据流

1. renderer 页面收集表单 → `window.anivault.saveConfig(config)`（preload 的 contextBridge）
2. Electron main 进程收到 IPC `config:save`
3. main 调用 `src/config/validator.js` 校验；有错误直接返回，不写盘
4. 校验通过：先写 `content.json.tmp-*` 临时文件，再改名覆盖 `content.json`（原子写盘）
5. renderer 保存成功后重新读盘回显，确认回读一致

读取路径：`app.getAppPath()/content.json`（Demo 阶段即仓库根目录，后续打包再迁 `%APPDATA%`）。

## 自检命令

```powershell
node tests/run-tests.js          # 原项目回归，8 PASS
node tests/validator.test.js     # 校验器测试，≥9 PASS
pnpm exec electron . --smoke     # 开窗自检：打印 SMOKE_OK，退出 0
pnpm exec electron . --selftest  # 临时副本读写自检：打印 SELFTEST_OK，退出 0
```

## 后续（本 Demo 不做）

- 站点选择与多站适配
- 下载按钮与进度查看
- 单部番启停开关（需改 `anime_updater.js`）
- 安装包（Electron Builder）
- 配置迁到用户目录
