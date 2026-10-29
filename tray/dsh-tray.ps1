# Windows half of the optional DSH tray icon. It treats DSH like an ordinary app: launching it
# starts DSH when needed and opens the page; clicking the icon opens the page; "停止 DSH" stops
# DSH and removes the icon. Every action goes through tray/dsh-tray-host.sh inside WSL, named in
# dsh-tray.json next to this script (written by tray/install.sh).
param(
  # Autostart at sign-in: show the icon only, without starting DSH or opening a browser.
  [switch]$Quiet
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$config = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'dsh-tray.json') | ConvertFrom-Json
$Distro = [string]$config.distro
$Port = [int]$config.port
$HostScript = [string]$config.host

$created = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\DshTray-$Port", [ref]$created)
if (-not $created) { return }

# A menu drawn like a Windows 11 one: flat background, a rounded highlight inset from the edges,
# and system rounded corners with a shadow where DWM supports them (Windows 11; older systems keep
# square corners). WinForms' default renderer paints a full-width blue highlight instead.
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public class DshMenuRenderer : ToolStripRenderer {
  private readonly Color bg, hover, text, disabledText;
  public readonly Color Border;
  public DshMenuRenderer(bool dark) {
    bg = dark ? Color.FromArgb(44, 44, 44) : Color.FromArgb(249, 249, 249);
    hover = dark ? Color.FromArgb(64, 64, 64) : Color.FromArgb(232, 232, 232);
    Border = dark ? Color.FromArgb(62, 62, 62) : Color.FromArgb(218, 218, 218);
    text = dark ? Color.FromArgb(243, 243, 243) : Color.FromArgb(26, 26, 26);
    disabledText = dark ? Color.FromArgb(130, 130, 130) : Color.FromArgb(150, 150, 150);
  }
  protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e) {
    using (var brush = new SolidBrush(bg)) e.Graphics.FillRectangle(brush, e.AffectedBounds);
  }
  protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e) {
    if (Rounded) return;  // DWM draws the border around rounded menus
    using (var pen = new Pen(Border)) e.Graphics.DrawRectangle(pen, 0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
  }
  protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e) {
    if (!e.Item.Selected || !e.Item.Enabled) return;
    var r = new Rectangle(4, 1, e.Item.Width - 8, e.Item.Height - 2);
    e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
    using (var path = RoundedRect(r, 4)) using (var brush = new SolidBrush(hover)) e.Graphics.FillPath(brush, path);
  }
  protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e) {
    e.TextColor = e.Item.Enabled ? text : disabledText;
    base.OnRenderItemText(e);
  }
  public bool Rounded;
  private static GraphicsPath RoundedRect(Rectangle r, int radius) {
    var path = new GraphicsPath();
    int d = radius * 2;
    path.AddArc(r.X, r.Y, d, d, 180, 90);
    path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
    path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
    path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
    path.CloseFigure();
    return path;
  }
  [DllImport("dwmapi.dll")]
  private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
  // DWMWA_WINDOW_CORNER_PREFERENCE = 33 (DWMWCP_ROUND = 2), DWMWA_BORDER_COLOR = 34 (COLORREF).
  public void RoundCorners(IntPtr hwnd) {
    try {
      int round = 2;
      Rounded = DwmSetWindowAttribute(hwnd, 33, ref round, 4) == 0;
      int color = Border.R | (Border.G << 8) | (Border.B << 16);
      DwmSetWindowAttribute(hwnd, 34, ref color, 4);
    } catch (DllNotFoundException) { Rounded = false; } catch (EntryPointNotFoundException) { Rounded = false; }
  }
}
'@

function Test-DarkMode {
  try { return (Get-ItemPropertyValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' 'AppsUseLightTheme') -eq 0 }
  catch { return $false }
}

$script:starting = $false
$script:startDeadline = [DateTime]::MinValue

# Run one dsh-tray-host.sh command in WSL without a console window.
function Invoke-TrayHost([string]$Command, [switch]$Wait, [switch]$Capture) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = 'wsl.exe'
  $info.Arguments = "-d $Distro -e bash -l `"$HostScript`" $Command"
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = [bool]$Capture
  $process = [System.Diagnostics.Process]::Start($info)
  if ($Capture) { $output = $process.StandardOutput.ReadToEnd().Trim(); $process.WaitForExit(); return $output }
  if ($Wait) { $process.WaitForExit(); return $process.ExitCode }
}

function Test-Running {
  $client = New-Object System.Net.Sockets.TcpClient
  try { return ($client.ConnectAsync('127.0.0.1', $Port).Wait(300) -and $client.Connected) }
  catch { return $false }
  finally { $client.Close() }
}

function Get-DshUrl {
  $url = Invoke-TrayHost 'url' -Capture
  if ($url -match "^http://127\.0\.0\.1:$Port/") { return $url }
  return $null
}

$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = New-Object System.Drawing.Icon (Join-Path $PSScriptRoot 'whale.ico')
$icon.Text = 'DSH'
$icon.Visible = $true

function Show-Tip([string]$Text, [string]$Kind = 'Info') {
  $icon.ShowBalloonTip(5000, 'DSH', $Text, [System.Windows.Forms.ToolTipIcon]$Kind)
}

function Start-Dsh {
  if ($script:starting) { return }
  Invoke-TrayHost 'start'
  $script:starting = $true
  # Generous: a launcher may check for updates before the server listens.
  $script:startDeadline = (Get-Date).AddMinutes(5)
  Update-State $false
}

function Open-Dsh {
  if (-not (Test-Running)) { Start-Dsh; return }
  $url = Get-DshUrl
  if ($url) { Start-Process $url } else { Show-Tip '没找到登录地址，请在终端里启动 DSH。' 'Warning' }
}

function Exit-Tray {
  $timer.Stop()
  $icon.Visible = $false
  $icon.Dispose()
  [System.Windows.Forms.Application]::Exit()
}

# Stopping DSH is quitting the app: the icon goes away with it.
function Stop-Dsh {
  if (Test-Running) {
    $answer = [System.Windows.Forms.MessageBox]::Show(
      '停止 DSH 会中断正在运行的任务和后台任务。确定停止吗？', 'DSH',
      [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Warning)
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    $icon.Text = 'DSH：正在停止…'
    if ((Invoke-TrayHost 'stop' -Wait) -ne 0) { Show-Tip 'DSH 没有停下来，请在终端里检查。' 'Warning'; return }
  }
  Exit-Tray
}

$dark = Test-DarkMode
$renderer = New-Object DshMenuRenderer $dark
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menu.Renderer = $renderer
$menu.ShowImageMargin = $false
$menu.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 9.5)
$menu.Padding = New-Object System.Windows.Forms.Padding(0, 5, 0, 5)
$menu.DropShadowEnabled = $true
$menu.Add_HandleCreated({ $renderer.RoundCorners($menu.Handle) })
$openItem = $menu.Items.Add('打开 DSH')
$stopItem = $menu.Items.Add('停止 DSH')
foreach ($item in @($openItem, $stopItem)) {
  $item.AutoSize = $false
  $item.Size = New-Object System.Drawing.Size(150, 32)
  $item.Padding = New-Object System.Windows.Forms.Padding(12, 0, 12, 0)
  $item.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
}
$icon.ContextMenuStrip = $menu

function Update-State([bool]$Running) {
  $icon.Text = if ($Running) { "DSH：运行中（$Port）" } elseif ($script:starting) { 'DSH：正在启动…' } else { 'DSH：未运行，单击启动' }
  $openItem.Text = if ($Running) { '打开 DSH' } else { '启动 DSH' }
  $openItem.Enabled = -not $script:starting
}

# A failed click must not take the tray down with it.
function Invoke-Safely([scriptblock]$Action) {
  try { & $Action } catch { Show-Tip "操作失败：$($_.Exception.Message)" 'Error' }
}

$openItem.Add_Click({ Invoke-Safely { Open-Dsh } })
$stopItem.Add_Click({ Invoke-Safely { Stop-Dsh } })
$icon.Add_MouseClick({ if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Invoke-Safely { Open-Dsh } } })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({
  Invoke-Safely {
    $running = Test-Running
    if ($script:starting) {
      $url = if ($running) { Get-DshUrl } else { $null }
      if ($url) { $script:starting = $false; Start-Process $url }
      elseif ((Get-Date) -gt $script:startDeadline) {
        $script:starting = $false
        Show-Tip '启动超时，请在终端里启动 DSH 查看原因。' 'Warning'
      }
    }
    Update-State $running
  }
})

if (-not $Quiet) { Invoke-Safely { Open-Dsh } }
Update-State (Test-Running)
$timer.Start()
[System.Windows.Forms.Application]::Run()
$mutex.ReleaseMutex()
