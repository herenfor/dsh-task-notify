# DSH task notifications

An unofficial task completion notification plugin for DeepSeek Harness.

The Web profile loads this DSH plugin on the host. It observes `session/event`
and notifies only when a top-level `turn/end` has reason `completed`. It works
with the Minimal preset and does not require model tools or changes to the
agent runtime. Notifications do not open browsers, select conversations, or
run a Windows click handler.

## Delivery

1. `notification-channel.mjs` sends the completion to one connected browser
   page with notification permission. DSH's existing authentication protects
   the event stream, status endpoint, worker script, and icon.
2. The page asks `notification-worker.js` to display a browser notification
   and acknowledges submission. Multiple pages produce one notification;
   the host prefers the currently or most recently focused capable page.
3. If no capable page exists, submission fails, or no acknowledgement arrives
   within 2.5 seconds, the host starts `notify-windows.sh` asynchronously.
4. The script tries Windows PowerShell 5.1, then optionally pwsh with BurntToast
   1.1.0. Both paths use DSH's own identity and the same Chinese content.

The event observer returns immediately. Notification and diagnostic logging
failures cannot change the task result. Late browser submissions are declined
or closed to avoid leaving a second card beside the Windows fallback.

## Requirements and supported mode

- DSH `0.2.0-rc.2`, using the Web profile.
- Windows 11 with WSL2 for the Windows notification fallback. DSH runs in WSL,
  with Windows executable interoperability enabled.
- A Node.js version supported by DSH; verification used Node.js `22.23.2`.
- `pnpm` on PATH for `dsh plugin` installation.

The Minimal agent preset inside the Web profile is supported. The separate
`headless`, `sdk`, and `sdk-minimal` profiles are not supported by this version:
its host entry requires the Web server and browser Connection services.

The plugin runs in the DSH host. The Windows sender uses the host user's
permissions to submit notifications and register DSH's per-user display name
and icon. It is independent of the model's tool list and agent tool sandbox.
It adds no model tool or prompt content.

## Install into a Web profile

The package declares `dsh.bundle.patch` pointing to its own `cordis.patch.yml`.
That layer inserts the host plugin by package name. The existing `dsh.client`
declaration supplies its browser half. Installing the bundle enables both;
users do not need to add a plugin source path to their profile patch.

Install directly from GitHub in WSL:

```bash
dsh plugin --profile web add github:herenfor/dsh-task-notify
```

The current JavaScript files run directly, so this package has no installation
build script. For reproducible installations, append `#<commit-sha>` to the
GitHub package specifier after choosing the revision to install.

Alternatively, clone the repository and install from its directory:

```bash
git clone https://github.com/herenfor/dsh-task-notify.git
cd dsh-task-notify
dsh plugin --profile web add "$PWD"
```

Restart DSH after active tasks finish, then refresh its browser page. If the
profile already contains the earlier manual `task-notify` entry with a local
file URL, remove that entry when migrating: the user's profile patch overrides
the installed bundle layer.

To install a packaged copy, run `pnpm pack` in the plugin directory, then:

```bash
dsh plugin --profile web add "$PWD/dsh-task-notify-0.0.1.tgz"
```

To remove the dependency and its bundle layer:

```bash
dsh plugin --profile web remove dsh-task-notify
```

Installation verification on 2026-10-03 used DSH `0.2.0-rc.2`, Node.js
`22.23.2`, Windows 11, and WSL2. A packed copy was installed into a fresh,
isolated DSH home and Web profile. The bundle was added automatically without
a manual plugin patch; the host activated, the task notification settings
appeared, Chromium registered the worker and submitted a test notification
without page errors, and the installed Windows sender exited successfully.
Removal cleared the dependency and bundle layer. The test server was stopped
after verification; the existing DSH service continued running.

## Browser setup

Refresh DSH, open Settings → 任务通知 → 启用浏览器通知, and allow notifications.
Use 测试通知 to check the card. Permission belongs to the browser profile and
website origin. Disabling browser notifications preserves Windows fallback.

A test is titled `DSH · 通知测试`. A completed turn is titled
`DSH · 本轮已完成`, with the conversation title when available. Neither message
promises a click action. Clicking only closes the browser notification.

The worker has the narrow `/dsh-task-notify/` scope, no fetch handler, and no
page navigation code. It does not control the DSH page or maintain a background
connection. A connected page is required for new browser notifications.
Browser notification sound depends on the browser and Windows settings.

## Windows fallback

Run `./notify-windows.sh` from WSL to test this path. The card uses
`DeepSeek Harness`, the whale icon, `任务已完成`, `本轮对话已正常结束。`, and
the default Windows notification sound. Its XML has no launch URI or actions.

`notification-identity.ps1` registers the per-user
`DeepSeekHarness.TaskNotification` display name and icon. Whale assets are
copied to `%LOCALAPPDATA%\DeepSeekHarness\TaskNotification`. No protocol handler
is installed, and PowerShell's own identity is not used as a fallback.

Windows PowerShell 5.1 is preferred. The optional pwsh path requires
`Install-Module BurntToast -RequiredVersion 1.1.0 -Scope CurrentUser`.
`DSH_NOTIFY_POWERSHELL` and `DSH_NOTIFY_PWSH` override executable paths.
Both commands have an eight-second timeout. If both fail, the host logs the
failure without affecting DSH. `notification-content.ps1` must retain its
UTF-8 BOM so Windows PowerShell 5.1 reads Chinese correctly.

## Development

`package.json` declares the browser module through `./client` and `dsh.client`.
Its only UI extension is the task notification settings section.
`notification.log` records process IDs, completion session IDs, submission
results, and failures; it does not record conversation text. `server.log` can
contain private startup URLs and must not be shared unredacted.

After changing host code, restart DSH once active tasks have completed and
check for `plugin-loaded` under the new process ID. Refresh existing browser
pages to load the frontend change. Old Windows cards retain their original
activation settings until cleared; an updated browser worker closes its old
cards when activated.

Run `npm test` from a source checkout for delivery, fallback, authentication,
expiry, and notification-only click checks. Automated browser checks cannot
establish the actual Windows appearance or sound; use the manual test above.

## License

The plugin code is licensed under [MIT](LICENSE).
The DeepSeek whale icon is an upstream asset; its origin and upstream license
are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
