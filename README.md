# 番仓 AniVault（Demo 0.1.0）

AGE 动漫自动追更下载器的新桌面面板。当前是第一个可运行 Demo：打开窗口就能查看、修改并保存 `content.json` 里的全部现有配置，原自动更新脚本与测试保持原样作为基线。

## 能做什么（Demo 范围）

- 左栏修改全局设置：每日抓取时间、单次最多下载、缺失自动补下、IDM 自动关闭
- 右栏管理追番清单：增删番剧、改片名、改每部番的全部字段（site_id、update_time、downloaded_start/end、site_latest、folder_name、file_name）
- 保存前逐字段校验，非法值拒绝写盘并显示错误
- 原子写盘（先写临时文件再改名），未知字段原样保留

暂不包含：站点选择、多站爬取、下载按钮、安装包、单部番启停开关（见 BLOCKED.md）。

## 环境

- Windows
- Node.js 与 pnpm（本项目可用自带运行时）
- 首次运行前执行 `pnpm install` 安装 Electron

## 安装与运行

```powershell
pnpm install
pnpm exec electron .
```

## 自检

```powershell
pnpm exec electron . --smoke      # 打开窗口，加载成功打印 SMOKE_OK 并退出 0
pnpm exec electron . --selftest   # 临时副本读→改 max_download=7→存→回读=7→恢复，打印 SELFTEST_OK
node tests/run-tests.js           # 原项目回归测试，8 PASS
node tests/validator.test.js      # 配置校验测试
```

当前版本 0.1.0（Demo），版本记录见使用说明.md 文末。
