# 开发说明

[返回 README](README.md)

这里保留插件的实现细节，方便阅读源码和继续开发。安装和使用步骤请看 README。

## 通知从哪里触发

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

## 验证与调试

```bash
npm test
npm pack --dry-run
```

现有 16 项自动测试覆盖浏览器提交、保底、身份验证、超时、过期通知和仅关闭通知的点击行为。GitHub Actions 在 Linux 和 Windows 上运行 Node.js 22 / 24 测试；它不验证真实 Windows 桌面上的外观和提示音。

2026-10-03 已在隔离的 DSH home 中验证安装与卸载：bundle 自动加载、宿主激活、设置页出现、Chromium 提交通知无页面错误、安装包内的 Windows 发送脚本成功退出；未改变原有 DSH 服务。

修改宿主代码后，等待任务结束再重启 DSH；修改前端后刷新页面。`notification-content.ps1` 必须保留 **UTF-8 BOM**，以便 Windows PowerShell 5.1 正确读取中文。

`notification.log` 记录进程 ID、会话 ID、发送结果和失败信息，不记录对话正文；`server.log` 可能包含私有启动链接。两者均不进入 Git 和发布包。报告问题前，请去除日志中的私有地址和会话信息。

参与开发请看 [贡献指南](CONTRIBUTING.md)，版本变化请看 [更新记录](CHANGELOG.md)。问题反馈使用 [GitHub Issues](https://github.com/herenfor/dsh-task-notify/issues)。

## 打包和分发

插件使用 DSH 的 bundle 格式：`package.json` 中的 `dsh.bundle.patch` 指向
`cordis.patch.yml`，安装时自动加入宿主插件；`dsh.client` 提供浏览器部分。
当前 JavaScript 文件直接运行，无需安装时构建。

从本地源码安装：

```bash
git clone https://github.com/herenfor/dsh-task-notify.git
cd dsh-task-notify
dsh plugin --profile web add "$PWD"
```

生成并安装打包副本：

```bash
pnpm pack
dsh plugin --profile web add "$PWD/dsh-task-notify-0.0.1.tgz"
```

固定提交安装时，使用 `github:herenfor/dsh-task-notify#<commit-sha>`，
将占位符换成所选提交的完整 SHA。安装或升级后，等待任务结束再重启 DSH。

- [DSH 官方 README](https://github.com/deepseek-ai/deepseek-harness#community-and-support) 推荐在插件仓库添加 `dsh-plugin` topic，便于发现。
- [官方打包与安装教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md) 说明 bundle 声明、配置层和 GitHub 安装方式。

本仓库通过 GitHub 分发，`package.json` 保留 `private: true`，防止误发布到 npm；这不会阻止从 GitHub 或本地安装。

## Windows 发送路径

`notify-windows.sh` 依次尝试 PowerShell 5.1 和 pwsh，每条路径各有 8 秒超时。
可以用 `DSH_NOTIFY_POWERSHELL`、`DSH_NOTIFY_PWSH` 指定可执行文件，两者都使用
WSL 能访问的路径。两条路径都失败时，只记录失败信息，不改变 DSH 任务结果。

`notification-identity.ps1` 以当前 Windows 用户登记
`DeepSeekHarness.TaskNotification`，图标复制到
`%LOCALAPPDATA%\DeepSeekHarness\TaskNotification`。通知 XML 没有启动 URL
或操作按钮，插件不安装点击协议处理程序。
