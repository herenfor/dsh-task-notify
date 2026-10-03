# DSH Task Notify · 任务完成通知

[![MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.0--rc.2-blue)](#适用环境)
[![测试](https://github.com/herenfor/dsh-task-notify/actions/workflows/test.yml/badge.svg)](https://github.com/herenfor/dsh-task-notify/actions/workflows/test.yml)

中文 | [English](README.en.md)

DeepSeek Harness 的社区任务通知插件。正常结束一轮对话后，优先通过浏览器显示系统通知；浏览器不可用时，使用 Windows 通知保底。

本项目由社区独立开发，非 DeepSeek 官方插件。

## 功能

- **浏览器优先**：已打开的 DSH 页面获得通知权限后，可以发送通知；多个页面只选择一个发送。
- **Windows 保底**：没有可用页面、浏览器发送失败或确认超时后，调用 Windows 通知并使用默认提示音。
- **支持 minimal 预设**：监听宿主的生命周期事件，不需要 AI 调用工具。
- **失败不影响任务**：通知异步发送，发送失败只记录诊断信息。
- **仅做通知**：没有跳转对话或启动浏览器的点击处理；浏览器通知点击后关闭卡片。

这里的“完成”指顶层会话收到 `turn/end`，且结束原因为 `completed`，不是判断整个项目目标是否达成。取消、失败或委派的子会话结束不会触发通知。

## 适用环境

| 项目 | 当前支持范围 |
| --- | --- |
| DSH | 已验证 `0.2.0-rc.2` |
| 运行方式 | `web` profile，包含该 profile 内的 minimal agent 预设 |
| Windows 保底 | Windows 11 + WSL2，DSH 运行在 WSL，已启用 Windows 可执行文件互操作 |
| Node.js | DSH 支持的版本；本地验证使用 `22.23.2` |
| 包管理器 | 安装插件时需要 `pnpm` 在 PATH 中 |

独立的 `headless`、`sdk`、`sdk-minimal` profile 当前不支持，因为插件宿主入口依赖 Web 服务和浏览器连接服务。**minimal agent 预设和 `sdk-minimal` profile 是不同概念。**

浏览器通知需要安全上下文（本机 `http://127.0.0.1` / `http://localhost` 或 HTTPS）、浏览器支持 Service Worker，并允许该网站发送通知。

## 安装

在 WSL 中执行：

```bash
dsh plugin --profile web add github:herenfor/dsh-task-notify
```

安装后，等待正在运行的任务结束，再重启 DSH 并刷新浏览器页面。

插件使用 DSH 官方的 bundle 格式：`package.json` 中的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，安装时自动加入宿主插件；`dsh.client` 提供浏览器部分。无需手动添加源码路径，也无需安装时构建。

如需固定版本，把安装命令中的仓库地址改为 `github:herenfor/dsh-task-notify#<commit-sha>`，将占位符替换为所选提交的完整 SHA。

### 从本地源码安装

```bash
git clone https://github.com/herenfor/dsh-task-notify.git
cd dsh-task-notify
dsh plugin --profile web add "$PWD"
```

如果之前手动在 profile 中添加过 `id: task-notify`、使用本地文件 URL 的插件条目，迁移时删除旧条目。用户的 profile patch 优先于 bundle，旧配置可能覆盖新安装的插件。

### 打包与卸载

```bash
# 在源码目录生成安装包
pnpm pack
dsh plugin --profile web add "$PWD/dsh-task-notify-0.0.1.tgz"

# 卸载依赖及其 bundle 配置层
dsh plugin --profile web remove dsh-task-notify
```

卸载后重启 DSH。Windows 端已登记的通知名称和图标不会随包卸载自动清除。

## 启用浏览器通知

1. 打开 DSH 的 **设置 → 任务通知**。
2. 点击 **启用浏览器通知**，允许网站通知权限。
3. 点击 **测试通知**，确认收到通知。

通知权限属于具体浏览器配置和网站地址。更换浏览器、端口或域名后，需要重新允许通知。

| 场景 | 通知内容 |
| --- | --- |
| 浏览器测试 | `DSH · 通知测试` |
| 浏览器任务完成 | `DSH · 本轮已完成`；可获取时包含对话标题 |
| Windows 保底 | 来源 `DeepSeek Harness`，标题 `任务已完成`，正文 `本轮对话已正常结束。` |

浏览器通知需要至少一个 DSH 页面保持连接。关闭浏览器通知、关闭所有页面或通知权限被拒绝时，任务完成会走 Windows 保底。设置中的 **测试通知** 只测试浏览器路径。

浏览器通知的提示音由浏览器和 Windows 设置决定；Windows 保底请求默认通知提示音。勿扰模式和系统通知设置可能影响实际显示或声音。

## Windows 保底

可以在 WSL 的源码目录单独测试：

```bash
./notify-windows.sh
```

发送顺序如下：

1. **Windows PowerShell 5.1**：优先使用系统自带版本，支持中文，无需额外模块。
2. **PowerShell 7（pwsh）**：第一条路径失败后尝试；需要安装 BurntToast `1.1.0`。

如需第二条路径，在 Windows 的 pwsh 中执行：

```powershell
Install-Module BurntToast -RequiredVersion 1.1.0 -Scope CurrentUser
```

两条路径各有 8 秒超时。可通过 `DSH_NOTIFY_POWERSHELL`、`DSH_NOTIFY_PWSH` 指定可执行文件路径，两个值都使用 WSL 能访问的路径。

插件以当前 Windows 用户登记 `DeepSeekHarness.TaskNotification` 通知身份，使用 DeepSeek 鲸鱼图标；图标复制到 `%LOCALAPPDATA%\DeepSeekHarness\TaskNotification`。通知 XML 没有启动 URL 或操作按钮，插件不安装点击协议处理程序。

## 工作原理：宿主、agent 与 sandbox

```text
DSH 宿主收到 session/event
  └─ 顶层 turn/end + completed
      └─ 异步发送到一个有通知权限的浏览器页面
          ├─ 2.5 秒内确认提交 → 浏览器显示通知
          └─ 不可用 / 失败 / 超时 → Windows 发送脚本
```

| 文件 | 职责 |
| --- | --- |
| `task-notify.mjs` | 宿主插件入口，筛选完成事件并启动异步通知 |
| `notification-channel.mjs` | 受 DSH 身份验证保护的浏览器通道、页面选择与超时保底 |
| `client.js` | DSH 浏览器插件与“任务通知”设置页 |
| `notification-worker.js` | 显示浏览器通知，点击时关闭卡片 |
| `notify-windows.sh` | 从 WSL 调用 Windows 发送路径并控制超时 |
| `notification-identity.ps1` | 登记 Windows 通知名称和图标 |
| `notification-content.ps1` | 中文通知内容与 XML |

宿主插件监听 agent 已经发出的事件，因此即使 AI 没有任何工具，完成通知也能触发。插件不增加模型工具或提示词，也不修改 agent runtime。

通知脚本以宿主用户的权限运行，不经过 agent 的工具 sandbox。这是宿主侧的通知能力；agent 的工具授权不会决定它是否运行。

浏览器的事件通道、状态接口、Worker 脚本和图标均经过 DSH 原有身份验证。Worker 仅使用 `/dsh-task-notify/` 范围，没有 fetch 处理或页面导航，不接管 DSH 页面，也不建立独立的常驻服务。浏览器确认表示通知已提交给浏览器，并不证明用户已经看到通知。

## 验证与开发

```bash
npm test
npm pack --dry-run
```

现有 16 项自动测试覆盖浏览器提交、保底、身份验证、超时、过期通知和仅关闭通知的点击行为。GitHub Actions 在 Linux 和 Windows 上运行 Node.js 22 / 24 测试；它不验证真实 Windows 桌面上的外观和提示音。

2026-10-03 已在隔离的 DSH home 中验证安装与卸载：bundle 自动加载、宿主激活、设置页出现、Chromium 提交通知无页面错误、安装包内的 Windows 发送脚本成功退出；未改变原有 DSH 服务。

修改宿主代码后，等待任务结束再重启 DSH；修改前端后刷新页面。`notification-content.ps1` 必须保留 **UTF-8 BOM**，以便 Windows PowerShell 5.1 正确读取中文。

`notification.log` 记录进程 ID、会话 ID、发送结果和失败信息，不记录对话正文；`server.log` 可能包含私有启动链接。两者均不进入 Git 和发布包。报告问题前，请去除日志中的私有地址和会话信息。

参与开发请看 [贡献指南](CONTRIBUTING.md)，版本变化请看 [更新记录](CHANGELOG.md)。问题反馈使用 [GitHub Issues](https://github.com/herenfor/dsh-task-notify/issues)。

## 官方插件规范

- [DSH 官方 README](https://github.com/deepseek-ai/deepseek-harness#community-and-support) 推荐在插件仓库添加 `dsh-plugin` topic，便于发现。
- [官方打包与安装教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md) 说明 bundle 声明、配置层和 GitHub 安装方式。

本仓库通过 GitHub 分发，`package.json` 保留 `private: true`，防止误发布到 npm；这不会阻止从 GitHub 或本地安装。

## 许可证

插件代码采用 [MIT](LICENSE) 许可证。DeepSeek 鲸鱼图标来自上游 DSH，出处和原始许可保存在 [第三方声明](THIRD_PARTY_NOTICES.md)。
