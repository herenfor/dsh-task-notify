# DSH | dsh-task-notify | 任务结束后提醒你 / Task completion notifications

> 非官方社区插件，由我独立维护，与 DeepSeek 官方无隶属关系。
> Unofficial community plugin, independently maintained and not affiliated with DeepSeek.

[GitHub 仓库](https://github.com/herenfor/dsh-task-notify) · [中文 README](https://github.com/herenfor/dsh-task-notify/blob/v0.0.1/README.md) · [English README](https://github.com/herenfor/dsh-task-notify/blob/v0.0.1/README.en.md) · [v0.0.1](https://github.com/herenfor/dsh-task-notify/releases/tag/v0.0.1)

我经常让 DSH 跑比较长的任务，切到别的窗口以后，就不知道它什么时候结束了。有时已经跑完了，我还在隔一会儿切回去看一次。所以做了这个小插件：一轮对话正常结束后，弹个通知提醒我回来查看结果。

它优先使用浏览器通知；没有可用的浏览器页面、没有通知权限，或者提交失败时，会尝试 Windows 系统通知。当前主要在 **Windows 11 + WSL2** 下使用，DSH 运行在 WSL 中。

![DSH 运行任务，切换到其他窗口后收到完成通知](https://raw.githubusercontent.com/herenfor/dsh-task-notify/v0.0.1/assets/demo.gif)

它通过 DSH 的宿主插件机制监听 `session/event`，只处理顶层会话正常完成的 `turn/end`，再异步发送通知。Web 模式里的 minimal 预设也能用，模型没有工具同样可以触发；通知失败不会改变任务结果。取消、出错和委派的子任务结束时不提醒。

安装到 Web profile：

```bash
dsh plugin --profile web add github:herenfor/dsh-task-notify#v0.0.1
```

等正在运行的任务结束后重启 DSH、刷新页面，在 **设置 → 任务通知 → 启用浏览器通知** 中允许通知，再点“测试通知”。Windows 保底路径默认使用系统自带的 PowerShell 5.1，不需要额外安装模块；它会请求默认提示音，实际声音取决于系统设置。

已在 DSH `0.2.0-rc.2` 下验证。目前只做完成提醒，点击通知不跳转到对话；独立的 headless / SDK profile 暂不支持。

**English**

I often leave DSH running a long task and switch to another window, then keep checking whether it has finished. This plugin sends a notification when a top-level turn completes normally.

It prefers browser notifications and falls back to a Windows toast when no capable browser page is connected or delivery fails. It runs as a DSH host plugin, so the Web minimal preset works even without model tools. Notification failures do not affect the task.

Tested with DSH `0.2.0-rc.2` on Windows 11 + WSL2. Use the install command above, restart DSH after your current task finishes, refresh the page, then enable notifications in Settings → 任务通知. This initial version only sends reminders; clicking does not open a conversation. Standalone headless / SDK profiles are not supported.

如果你也会让 DSH 在后台跑任务，欢迎试试。有问题可以回帖，或在 [Issues](https://github.com/herenfor/dsh-task-notify/issues) 留下 DSH 版本、浏览器和复现步骤；分享日志前记得去掉凭证和会话信息。

Feedback is welcome here or in the repository issues.
