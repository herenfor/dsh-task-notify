# DSH Task Notify · 任务完成通知

[![MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.0--rc.2-blue)](#使用环境)
[![测试](https://github.com/herenfor/dsh-task-notify/actions/workflows/test.yml/badge.svg)](https://github.com/herenfor/dsh-task-notify/actions/workflows/test.yml)

中文 | [English](README.en.md)

让 DeepSeek Harness 在一轮对话结束后提醒你。

插件优先使用浏览器通知。如果浏览器没有打开、没有通知权限，或者发送失败，就改用 Windows 系统通知。你可以切到别的窗口做事，收到提醒后再回来查看结果。

这是一个社区插件，目前主要在 **Windows 11 + WSL2** 环境下使用。

## 功能

- 一轮对话正常结束时发送通知，取消、出错和委派的子任务结束时不提醒。
- 支持 Web 模式里的 minimal 预设，AI 没有工具也能触发。
- Windows 通知使用 DSH 名称、鲸鱼图标和默认提示音。
- 通知失败不会影响任务运行。

目前只做完成提醒，暂不支持点击通知后跳转到对应对话。

## 使用环境

已在 DSH `0.2.0-rc.2`、Node.js `22.23.2`、Windows 11 + WSL2 下验证，DSH 运行在 WSL 中。

使用前需要：

- DSH 的 `web` profile，以及 DSH 支持的 Node.js 版本。
- 安装插件时，WSL 能找到 `pnpm`。
- WSL 能运行 Windows 程序，以便发送 Windows 通知。

Web 里的 minimal 预设可以使用。独立的 `headless`、`sdk` 和 `sdk-minimal` profile 暂不支持。

## 安装

在 WSL 终端运行：

```bash
dsh plugin --profile web add github:herenfor/dsh-task-notify
```

安装后，等当前任务结束，再重启 DSH 并刷新浏览器页面。插件会自动加载，无需手动添加源码路径。

如果之前用本地路径手动加载过测试版，请删除 profile 中旧的 `task-notify` 条目，避免它覆盖新安装的版本。

## 开启浏览器通知

1. 打开 DSH 的 **设置 → 任务通知**。
2. 点击 **启用浏览器通知**，在浏览器提示中选择允许。
3. 点击 **测试通知**，确认能收到提醒。

正常完成时，浏览器通知的标题是 `DSH · 本轮已完成`，能获取到对话标题时会一起显示。测试通知会标为 `DSH · 通知测试`。

浏览器通知需要有一个 DSH 页面保持连接。关闭所有页面、关闭浏览器通知，或未授予权限时，插件会使用 Windows 通知。

通知权限按浏览器和网站地址分别保存。换了浏览器、端口或域名，需要重新允许通知。页面应通过本机 `localhost` / `127.0.0.1` 或 HTTPS 打开。

## Windows 通知

默认使用 Windows 自带的 **PowerShell 5.1**，支持中文，不需要额外安装模块。通知会显示 `DeepSeek Harness` 和鲸鱼图标，提示“任务已完成”。

如果这条路径失败，插件会再尝试 **pwsh + BurntToast 1.1.0**。想启用这条备用路径，可以在 Windows 的 pwsh 中运行：

```powershell
Install-Module BurntToast -RequiredVersion 1.1.0 -Scope CurrentUser
```

浏览器通知的声音取决于浏览器和 Windows 设置；Windows 保底通知使用默认提示音。如果没有看到通知或听到声音，也可以检查系统通知设置和勿扰模式。

## 卸载

```bash
dsh plugin --profile web remove dsh-task-notify
```

卸载后重启 DSH。Windows 中已经登记的通知名称和图标会保留。

## 遇到问题

- **浏览器没有通知**：先点击设置里的“测试通知”，检查网站通知权限。这一步只测试浏览器通知。
- **想单独测试 Windows 通知**：在插件源码目录中，从 WSL 运行 `./notify-windows.sh`。
- **安装后看不到“任务通知”设置**：确认正在使用 `web` profile，已重启 DSH 并刷新页面；检查是否还留有旧测试版的手动配置。

仍有问题，可以到 [Issues](https://github.com/herenfor/dsh-task-notify/issues) 反馈，附上 DSH 版本、浏览器和复现步骤。分享日志前，请去掉凭证、私有启动链接和会话信息。

## 参与开发

想了解实现细节、从本地安装或打包，可以看 [开发说明](DEVELOPING.md)。提交修改前可以参考 [贡献指南](CONTRIBUTING.md)，版本变化记在 [更新记录](CHANGELOG.md) 中。

## 许可证

代码采用 [MIT](LICENSE) 许可证。鲸鱼图标来自 DeepSeek Harness，出处和原始许可见 [第三方声明](THIRD_PARTY_NOTICES.md)。本项目不是 DeepSeek 官方插件。
