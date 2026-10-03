# 更新记录

## 0.0.1 · 2026-10-03

首个公开版本。

- 宿主监听顶层会话正常完成事件，支持 Web profile 内的 minimal agent 预设。
- 浏览器通知优先，2.5 秒未确认或发送失败时走 Windows 保底。
- Windows PowerShell 5.1 优先，pwsh + BurntToast 1.1.0 作为第二条发送路径。
- 中文通知内容、DSH 通知身份、鲸鱼图标和默认 Windows 提示音。
- 通知失败不改变任务结果；不包含对话跳转或点击启动脚本。
- 按 DSH bundle 格式支持 GitHub、本地和安装包分发。
- MIT 许可证、图标上游许可和 16 项自动测试。

已验证环境：DSH 0.2.0-rc.2、Node.js 22.23.2、Windows 11 + WSL2。独立 headless / SDK profile 不在本版本支持范围内。
