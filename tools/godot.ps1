param(
    [ValidateSet('play', 'editor', 'test', 'economy', 'benchmark', 'capture')]
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
$runLog = Join-Path $taskRoot ".tools/godot-$Mode.log"
$arguments = @('--path', $projectPath, '--log-file', $runLog)
switch ($Mode) {
    'editor' { $arguments += '--editor' }
    'test' { $arguments += @('--headless', '--script', 'tests/headless.gd', '--quit-after', '2') }
    'economy' { $arguments += @('--headless', '--script', 'tests/food_integration.gd', '--quit-after', '2') }
    'benchmark' { $arguments += @('--headless', '--script', 'tests/benchmark.gd', '--quit-after', '2') }
    'capture' { $arguments += @('--script', 'tests/presentation_smoke.gd') }
}
if ($ExtraArgs) { $arguments += $ExtraArgs }
& $GodotPath @arguments
$processExit = $LASTEXITCODE
if ($Mode -in @('test', 'economy', 'benchmark', 'capture')) {
    $log = $runLog
    if (Test-Path -LiteralPath $log) {
        if (Select-String -LiteralPath $log -Pattern 'SCRIPT ERROR:|^ERROR:' -Quiet) { $processExit = 1 }
    }
}
exit $processExit
