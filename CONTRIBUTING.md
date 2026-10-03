# 贡献指南

感谢参与这个 DSH 社区插件。问题反馈和修改建议请提交到本仓库的 Issues；代码修改可通过 Pull Request 提交。

## 当前范围

当前版本只做正常完成通知：浏览器优先，Windows 保底。讨论 agent 行为时，请明确区分宿主生命周期、agent 预设和工具 sandbox。

与 agent 结束条件、失败隔离、权限边界相关的修改，请在 Pull Request 中说明行为变化和验证方法。

## 本地验证

在 DSH 支持的 Node.js 环境中执行：

```bash
npm test
npm pack --dry-run
```

本项目没有安装时构建步骤，也没有 npm 运行依赖。完整安装和手动测试步骤见 [README](README.md)。

Windows 通知的外观、提示音和窗口行为需要在 Windows 11 + WSL2 中实际检查。现有自动测试不能代替这一步。

修改宿主插件后，应等任务结束再重启 DSH。建议在隔离的 `DSH_HOME` 下验证安装与卸载，避免影响正在使用的 profile。

## 文件注意事项

- Shell 脚本保留 LF 行尾和可执行权限。
- `notification-content.ps1` 保留 UTF-8 BOM，保证 PowerShell 5.1 能读取中文。
- 不提交 `notification.log`、`server.log`、私有启动链接、访问凭证或真实对话日志。
- 保留鲸鱼图标的上游许可和来源声明。
- 改变安装方式、支持环境或用户可见行为时，同步更新中文与英文说明及更新记录。

贡献的代码使用本项目的 MIT 许可证。
