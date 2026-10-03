# 第一次社区发布准备

核查日期：2026-10-03。本文是本地准备记录，不表示已发布 Discussion、Git tag 或 GitHub Release。

## 官方要求

目标分类：[🙌 Show Your Plugins!](https://github.com/deepseek-ai/deepseek-harness/discussions/categories/show-your-plugins)。

置顶且锁定的 [Plugin Category Guidelines](https://github.com/deepseek-ai/deepseek-harness/discussions/2004) 当前要求：

- 一个 Discussion 只介绍一个项目，项目须有实际 DSH 集成。
- 标题使用 `DSH | Project Name | One-line description`，也提供中文全角分隔符格式。
- 正文包含项目地址、简短介绍、截图 / GIF / demo，以及 DSH 集成方式。
- 显著说明是独立维护的非官方项目。
- 分类按社区 Upvote 排序，Upvote 不代表 DeepSeek 官方审核或推荐。

指南没有规定正文长度，也没有要求中英文全文重复。安装命令并非指南单独列出的条款，但可以让首次访问者直接试用。

## 帖子样本

数字为 2026-10-03 读取讨论页面主帖的 Upvote 按钮所得；不是评论数或表情 reaction。长度为主帖正文提取后的字符数，混合中英文，供比较规模，不是严格字数统计。近期帖子是主要样本，另取两个较早的帖子作对照；这不是整个分类的排名。

| 帖子 | 主帖字符数 | Upvote | 展示方式与可以参考的部分 |
| --- | ---: | ---: | --- |
| [dsh-chamber #8724](https://github.com/deepseek-ai/deepseek-harness/discussions/8724)，10 月 3 日 | 880 | 1 | 中文开场，交代实际适用场景；仓库、安装入口明确，截图在 README。标题和媒体位置并不完全照指南，不照搬。 |
| [dsh-win2k #8705](https://github.com/deepseek-ai/deepseek-harness/discussions/8705)，10 月 2 日 | 1,472 | 1 | 按官方标题格式，中英文介绍分开，仓库 / README / 版本在顶部；共用安装代码块和真实截图。 |
| [浏览器插件踩坑记录 #8685](https://github.com/deepseek-ai/deepseek-harness/discussions/8685)，10 月 2 日 | 1,870 | 1 | 第一人称说明问题、复现和取舍，反馈问题具体。适合参考语气；通知插件用不着这么长的技术展开。 |
| [GenBox #8669](https://github.com/deepseek-ai/deepseek-harness/discussions/8669)，10 月 2 日 | 1,420 | 1 | 安装很早出现，集成机制和测试证据明确；功能清单较长，不适合本插件。 |
| [dsh-pwa #8004](https://github.com/deepseek-ai/deepseek-harness/discussions/8004)，9 月 27 日 | 1,911 | 2 | 中英文各一段完整介绍，说明使用场景、集成方式和兼容限制，附截图。 |
| [dsh-rewind #4592](https://github.com/deepseek-ai/deepseek-harness/discussions/4592)，8 月 26 日 | 1,255 | 4 | 明确使用问题，多张操作截图，安装命令可复制；有持续版本跟进。宣传、求 Star 和其他插件列表不采用。 |
| [dsh-token-price #1878](https://github.com/deepseek-ai/deepseek-harness/discussions/1878)，8 月 15 日 | 392 | 4 | 短介绍直接说明界面增加什么，附截图和仓库，评论中回应问题；缺少完整安装步骤，不照搬这个省略。 |

近期样本中，双语标题、英文后中文或中文后英文均有；也有中文单语。多数把安装命令放在代码块里，把仓库链接与 README 放在开头或结尾，演示用仓库图片或 GitHub 附件。本插件适合中文讲清实际经历，英文作短摘要，共用 GIF 和安装步骤，不必重复两套长文。

本次样本里，较早的 dsh-rewind 和 dsh-token-price 票数较高。可观察到的共同点是用途容易理解、有真实界面演示、维护者回应反馈；发帖时间更早也是重要差异。不能据这几个样本断言某种标题、双语安排或文案会带来更多票。

“自然”指表达有具体经历、限制和反馈方向，并不据文风判断作者是否使用 AI。推荐用“经常切到别的窗口，不知道任务何时结束”开场，只介绍一个完成提醒功能。

## 仓库与版本

- 当前公开代码版本 `0.0.1`，最新公开提交 `72fe982439dbceb5cfc8dbcb197c08e39a9ae7d0`。
- 远端已包含 `dsh-plugin`、`deepseek-harness`、`notifications`、`windows`、`wsl` topics。
- 中英文 README 已给出环境、安装、重启、通知授权、测试通知、保底方式和卸载步骤，足以让目标环境用户开始使用。
- GitHub 分发符合 [官方打包与安装教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)。代码直接运行，没有安装时构建步骤；`private: true` 防止误发 npm，不妨碍 GitHub 安装。
- 当前 16 项自动测试通过；安装包 dry run 为 21 个文件，不含运行日志。已有独立 DSH home 的安装、插件加载、浏览器提交、Windows 发送和卸载验证。
- 本次另外在全新 DSH home 中执行了 README 原样的 `dsh plugin --profile web add github:herenfor/dsh-task-notify`：安装成功，bundle 自动加入 Web profile，配置中出现宿主插件，运行脚本齐全；卸载成功。这个过程没有启动第二个服务或发送演示通知。
- [最新公开提交的 CI](https://github.com/herenfor/dsh-task-notify/actions/runs/37098158745) 已通过 Linux / Windows、Node.js 22 / 24 的组合。
- 已对当前跟踪文本文件扫描常见凭证、个人机器路径、私有启动链接和真实会话压缩包名称，没有发现匹配。扫描不能替代对录屏内容的人工检查。
- 尚无 Git tag 或 GitHub Release。推荐首个版本为 **v0.0.1**，与 package.json 和 CHANGELOG 一致，作为初始版本发布；无需新增功能或升级为 1.0。

## 素材与发布顺序

1. 在新的中性演示对话中录制真实短任务；用户切到空白窗口，等待正常完成通知。
2. 原始截图、帧序列和录制工具留在仓库外；成片裁切后逐帧检查，不包含账号、凭证、地址栏、私有路径、会话标识或其他工作的窗口内容。
3. 将最终 GIF 保存到 `assets/demo.gif`。GIF 不含音轨，不用于证明提示音。
4. 用户审阅成片和 `community-post.md` 后，才提交并推送发布素材。帖子中的 GIF URL 只有推送完成后才可访问。
5. 经用户确认，在同一个经检查的提交上创建 `v0.0.1` tag / Release。可以提供打包的 tgz，供不想从 GitHub 安装的用户使用。
6. 如果发布时已经有该 tag，可以把帖子安装命令固定为 `github:herenfor/dsh-task-notify#v0.0.1`；当前草稿保留已公开仓库的安装形式，不使用尚未存在的 tag。
7. 素材链接可访问后，再由用户确认发布 Discussion。一次只发一个帖子，不重复推广。

已完成 `assets/demo.gif`：约 6.8 秒，真实 Web 极简模式任务，先切到空白文本编辑器，再收到 Windows 显示的浏览器通知。原始帧和最终保留帧已逐帧审阅；成片遮挡通知来源地址，删除其他窗口预览、任务栏及准备阶段，放大最终通知区域，保留真实通知内容。详细说明见 `assets/README.md`。

发布前仍需用户审阅成片与文案，并确认素材推送，让帖子中的 GIF 链接真正可访问。现有安装和使用说明已齐全，暂未发现要求新增功能的发布阻碍。
