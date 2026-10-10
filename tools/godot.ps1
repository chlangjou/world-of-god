param(
    [ValidateSet('play', 'editor', 'test', 'benchmark', 'capture')]
    [string]$Mode = 'play',
    [string]$GodotPath = '',
    [string[]]$ExtraArgs = @()
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not $GodotPath) {
    $bundled = Get-ChildItem -LiteralPath (Join-Path $taskRoot '.tools/godot') -Filter '*_console.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bundled) { $GodotPath = $bundled.FullName }
    else {
        $installed = Get-Command godot,godot4 -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($installed) { $GodotPath = $installed.Source }
    }
}
if (-not $GodotPath -or -not (Test-Path -LiteralPath $GodotPath)) { throw 'Godot 4.x not found. Run tools/install-godot.ps1 or pass -GodotPath.' }
$env:APPDATA = Join-Path $taskRoot '.tools/userdata'
$projectPath = Join-Path $taskRoot 'godot'
$arguments = @('--path', $projectPath, '--log-file', (Join-Path $taskRoot '.tools/godot.log'))
switch ($Mode) {
    'editor' { $arguments += '--editor' }
    'test' { $arguments += @('--headless', '--script', 'tests/headless.gd') }
    'benchmark' { $arguments += @('--headless', '--script', 'tests/benchmark.gd') }
    'capture' { $arguments += @('--', '--capture') }
}
if ($ExtraArgs) { $arguments += $ExtraArgs }
& $GodotPath @arguments
exit $LASTEXITCODE
