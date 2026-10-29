# vargai installer — Windows.
#
#   irm https://varg.ai/install.ps1 | iex
#
# Puts the standalone vargai CLI (one .exe, no Node or Bun needed) in
# ~\.varg\bin and adds that to your user PATH. Run it again, or
# `vargai update`, to update. Releases: https://github.com/vargHQ/sdk/releases
#
#   $env:VARG_VERSION = "0.17.0"       install this version instead of the latest
#   $env:VARG_INSTALL_DIR = "C:\path"  install here instead of ~\.varg\bin

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repo = "vargHQ/sdk"
$dir = if ($env:VARG_INSTALL_DIR) { $env:VARG_INSTALL_DIR } else { Join-Path $HOME ".varg\bin" }
$version = $env:VARG_VERSION

$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") { "arm64" } else { "x64" }
$asset = "vargai-windows-$arch.zip"

if (-not $version) {
  # releases/latest redirects to the newest release's tag: a page, not the API,
  # so no 60-an-hour anonymous limit. The API is the fallback.
  try {
    $resp = Invoke-WebRequest "https://github.com/$repo/releases/latest" -Method Head -UseBasicParsing
    $final = if ($resp.BaseResponse.ResponseUri) { $resp.BaseResponse.ResponseUri.AbsoluteUri } else { $resp.BaseResponse.RequestMessage.RequestUri.AbsoluteUri }
    if ($final -match "/tag/cli-v([^/]+)$") { $version = $Matches[1] }
  } catch {}
  if (-not $version) {
    $releases = Invoke-RestMethod "https://api.github.com/repos/$repo/releases?per_page=30"
    $latest = $releases | Where-Object { $_.tag_name -like "cli-v*" -and -not $_.draft -and -not $_.prerelease } | Select-Object -First 1
    if (-not $latest) { throw "could not find the latest vargai release (https://github.com/$repo/releases). Set `$env:VARG_VERSION to pick one." }
    $version = $latest.tag_name.Substring(5)
  }
}
$version = ($version -replace "^cli-", "").TrimStart("v")
$base = "https://github.com/$repo/releases/download/cli-v$version"

Write-Host "vargai $version (windows-$arch)"

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("vargai-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Invoke-WebRequest "$base/$asset" -OutFile (Join-Path $tmp $asset) -UseBasicParsing
  Invoke-WebRequest "$base/SHA256SUMS" -OutFile (Join-Path $tmp "SHA256SUMS") -UseBasicParsing

  $line = Get-Content (Join-Path $tmp "SHA256SUMS") | Where-Object { $_ -match " $([regex]::Escape($asset))$" } | Select-Object -First 1
  if (-not $line) { throw "$asset is not in SHA256SUMS" }
  $expected = ($line -split " ")[0]
  $actual = (Get-FileHash (Join-Path $tmp $asset) -Algorithm SHA256).Hash.ToLower()
  if ($expected -ne $actual) { throw "checksum mismatch for $asset" }

  Expand-Archive (Join-Path $tmp $asset) -DestinationPath $tmp -Force
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  Move-Item (Join-Path $tmp "vargai.exe") (Join-Path $dir "vargai.exe") -Force
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

& (Join-Path $dir "vargai.exe") help | Out-Null
if ($LASTEXITCODE -ne 0) { throw "vargai is installed at $dir\vargai.exe but does not start" }

Write-Host "installed $dir\vargai.exe" -ForegroundColor Green

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not (($userPath -split ";") -contains $dir)) {
  [Environment]::SetEnvironmentVariable("Path", "$dir;$userPath", "User")
  $env:Path = "$dir;$env:Path"
  Write-Host "added $dir to your PATH (open a new terminal for other windows)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Try it:"
Write-Host '  vargai search "captions for reels"   find skills, no key needed'
Write-Host "  vargai login                        then every varg model and tool"
