# DSH Task Notify

[![MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.x-blue)](#requirements)
[![Tests](https://github.com/herenfor/dsh-task-notify/actions/workflows/test.yml/badge.svg)](https://github.com/herenfor/dsh-task-notify/actions/workflows/test.yml)

[中文](README.md) | English

Get a notification when DeepSeek Harness finishes a turn.

The plugin tries browser notifications first. If no connected page can send one, or delivery fails, it falls back to a Windows notification. You can work in another window and come back when the notification arrives.

This community plugin currently targets **Windows 11 + WSL2**, with DSH running in WSL.

![A DSH task completes and a notification appears after switching to another window](https://raw.githubusercontent.com/herenfor/dsh-task-notify/v0.0.1/assets/demo.gif)

## Features

- Notifies after a turn finishes normally. Cancelled turns, errors, and delegated child sessions do not trigger notifications.
- A turn that ends while background jobs it started (such as a build) are still running does not notify; you are notified once the jobs finish and the AI has handled the results.
- Also notifies when you are needed: an action is waiting for your approval, the AI asked you a question, or a turn ended with a question still unanswered. Anything you handle within 5 seconds is not announced.
- Works with the Minimal agent preset in the Web profile, even when the AI has no tools.
- Windows notifications use the DSH name, whale icon, and default notification sound.
- Notification failures do not affect the task.

Notifications only say what happened. Clicking a notification does not take you to the conversation.

## Requirements

Supports DSH `0.2.0-rc.2` and later `0.2.x` releases (`>=0.2.0-rc.2 <0.3.0-0`), so small DSH updates do not need a new plugin release; tested on `0.2.0-rc.2`, `0.2.1-rc.2`, `0.2.1-rc.3`, and `0.2.1-rc.4`. The plugin mainly targets Windows 11 + WSL2, with DSH running in WSL. Compatibility checks for `rc.3` and `rc.4` use Node.js `22.23.4`.

You need:

- DSH's `web` profile and a Node.js version supported by DSH.
- `pnpm` available in WSL when installing the plugin.
- WSL interoperability with Windows programs for the Windows fallback.

The Minimal preset within the Web profile is supported. The separate `headless`, `sdk`, and `sdk-minimal` profiles are not currently supported.

## Install

Run this in WSL:

```bash
dsh plugin --profile web add github:herenfor/dsh-task-notify#v0.0.3
```

Wait for active tasks to finish, restart DSH, and refresh its browser page. The plugin loads automatically; no source path needs to be added by hand.

If you previously loaded a test version through a local path, remove the old `task-notify` entry from your profile patch so it does not override the installed version.

## Enable browser notifications

1. Open **Settings → 任务通知** in DSH.
2. Click **启用浏览器通知** and allow notifications in the browser prompt.
3. Click **测试通知** to check that a notification appears.

The title says what happened: `DSH · 本轮已完成` (turn completed), `DSH · 等你回答` (turn ended with a question unanswered), `DSH · 需要审批` (approval needed) or `DSH · 需要你回答` (question asked), with the conversation title when available. Test notifications are labelled `DSH · 通知测试`.

At least one DSH page must stay connected to receive new browser notifications. If you close all pages, turn browser notifications off, or deny permission, the plugin uses Windows notifications instead.

Permission is saved for each browser profile and website address. Changing the browser, port, or domain requires permission again. Open DSH through local `localhost` / `127.0.0.1` or HTTPS.

## Windows notifications

The default sender uses the built-in **Windows PowerShell 5.1**, with Chinese support and no extra module required. Notifications show `DeepSeek Harness`, the whale icon, and a message saying what happened.

If that sender fails, the plugin tries **pwsh with BurntToast 1.1.0**. To enable this backup, run the following in Windows pwsh:

```powershell
Install-Module BurntToast -RequiredVersion 1.1.0 -Scope CurrentUser
```

Browser notification sound depends on the browser and Windows settings. The Windows fallback requests the default notification sound. If notifications or sound are missing, check Windows notification settings and Do Not Disturb.

## Tray icon (optional)

The package also ships an optional Windows tray icon that treats DSH like an ordinary app:

- Launch it: DSH starts if it is not running, then the page opens; if DSH is already running, the page opens.
- Click the icon to open the page. "停止 DSH" in the right-click menu stops DSH and removes the icon.
- The menu follows the Windows dark/light setting.

It is not a DSH plugin, so install it once from WSL:

```bash
bash ~/.dsh/profiles/web/node_modules/dsh-task-notify/tray/install.sh
```

The files go to `%USERPROFILE%\DshTray`. The installer asks whether to add a "DSH" desktop shortcut (default yes) and whether to show the icon at sign-in (default no; it only shows the icon and does not start DSH). `--desktop` / `--no-desktop` and `--autostart` / `--no-autostart` answer these up front, and `--port` sets the port when DSH does not listen on 3080. Then start it from the "DSH" desktop shortcut or `start-dsh-tray.vbs` in `%USERPROFILE%\DshTray`.

By default the tray starts DSH with `dsh web --no-open`. It only starts and stops DSH and never updates it. To use your own launcher instead, set it in `~/.config/dsh-tray/env`:

```bash
DSH_TRAY_START='my-launcher --no-open'   # must put itself in the background
DSH_TRAY_STOP='my-launcher stop'
DSH_TRAY_LOG="$HOME/.cache/my-launcher.log"   # where the launcher writes "dsh web: <url>"
```

To remove it, delete `%USERPROFILE%\DshTray`, the "DSH" desktop shortcut, and `DSH tray.vbs` in the Startup folder.

## Uninstall

```bash
dsh plugin --profile web remove dsh-task-notify
```

Restart DSH after removal. The display name and icon already registered in Windows remain in place.

## Troubleshooting

- **No browser notification:** Try the test button in settings and check the site's notification permission. This button only tests browser notifications.
- **Test Windows notifications separately:** Run `./notify-windows.sh` from the plugin source directory in WSL.
- **Notification settings are missing:** Check that you are using the `web` profile, have restarted DSH and refreshed the page, and have removed any old test-version profile entry.

For other problems, open an [issue](https://github.com/herenfor/dsh-task-notify/issues) with your DSH version, browser, and reproduction steps. Remove credentials, private startup links, and session information before sharing logs.

## Development

Implementation details, local installation, packaging, and verification notes are in [DEVELOPING.md](DEVELOPING.md) (Chinese). See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [CHANGELOG.md](CHANGELOG.md) for version history.

## License

Code is licensed under [MIT](LICENSE). The whale icon comes from DeepSeek Harness; its source and original license are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is not an official DeepSeek plugin.
