param([string]$Version = '4.7.2')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^4\.\d+(\.\d+)?$') { throw 'Expected a stable Godot 4.x version number.' }
$taskRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $taskRoot '.tools/godot'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$archive = Join-Path $destination 'godot.zip'
$download = "https://downloads.godotengine.org/?version=$Version&flavor=stable&platform=windows.64&slug=win64.exe.zip"
Invoke-WebRequest -Uri $download -OutFile $archive
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
New-Item -ItemType File -Path (Join-Path $destination '_sc_') -Force | Out-Null
& (Join-Path $destination "Godot_v$Version-stable_win64_console.exe") --version
