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

#
# Every release's SHA256SUMS is signed with the varg CLI release key, which
# never leaves the releaser's machine (vargHQ/mcp scripts/release-cli.sh).
# This script checks that signature against the public key below before it
# trusts a checksum, so an edited release or a swapped download cannot
# install. The key is also built into vargai, which checks it again on
# `vargai update`.

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repo = "vargHQ/sdk"
# SubjectPublicKeyInfo (DER, base64) of the ECDSA P-256 keys a release may be signed with.
$releaseKeys = @("MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYOag9iQfWoMmdhDjNirIF4Hxmgw1tFR3gQKm5KO2PTMWNCJ9stkEfPDJgpOiWGtxhh5gv95wxVbs9s+fwJqf0g==")

# Does $der (an openssl ECDSA signature: DER r, s) sign $data with one of $releaseKeys?
# CNG reads r||s and a raw key blob, which works on Windows PowerShell 5.1 and pwsh 7.
function Test-ReleaseSignature([byte[]]$data, [byte[]]$der) {
  $i = 0
  if ($der.Length -lt 8 -or $der[$i++] -ne 0x30) { return $false }
  $len = [int]$der[$i++]
  if ($len -band 0x80) { if (($len -band 0x7f) -ne 1) { return $false }; $len = [int]$der[$i++] }
  if ($i + $len -ne $der.Length) { return $false }
  $raw = New-Object byte[] 64
  foreach ($at in 0, 32) {
    if ($der[$i++] -ne 0x02) { return $false }
    $n = [int]$der[$i++]
    if ($n -lt 1 -or $i + $n -gt $der.Length) { return $false }
    $start = $i; $i += $n
    while ($n -gt 32 -and $der[$start] -eq 0) { $start++; $n-- }
    if ($n -gt 32) { return $false }
    [Array]::Copy($der, $start, $raw, $at + 32 - $n, $n)
  }
  foreach ($k in $releaseKeys) {
    $spki = [Convert]::FromBase64String($k)
    # P-256 SubjectPublicKeyInfo: a 26-byte header, then 04 || X || Y.
    $blob = New-Object byte[] 72
    [Array]::Copy([byte[]](0x45, 0x43, 0x53, 0x31, 0x20, 0, 0, 0), 0, $blob, 0, 8)   # "ECS1", 32-byte coordinates
    [Array]::Copy($spki, 27, $blob, 8, 64)
    try {
      $key = [System.Security.Cryptography.CngKey]::Import($blob, [System.Security.Cryptography.CngKeyBlobFormat]::EccPublicBlob)
      $ecdsa = New-Object System.Security.Cryptography.ECDsaCng($key)
      if ($ecdsa.VerifyData($data, $raw, [System.Security.Cryptography.HashAlgorithmName]::SHA256)) { return $true }
    } catch {}
  }
  return $false
}
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
  try {
    Invoke-WebRequest "$base/SHA256SUMS.sig" -OutFile (Join-Path $tmp "SHA256SUMS.sig") -UseBasicParsing
  } catch { throw "could not download SHA256SUMS.sig (releases before 0.21.0 are not signed; install 0.21.0 or later)" }

  $sums = [System.IO.File]::ReadAllBytes((Join-Path $tmp "SHA256SUMS"))
  $sig = [System.IO.File]::ReadAllBytes((Join-Path $tmp "SHA256SUMS.sig"))
  if (-not (Test-ReleaseSignature $sums $sig)) {
    throw "the signature on SHA256SUMS does not match the varg release key: not installing. Report it at https://github.com/$repo/issues"
  }
  # The signed file names its version, so an older signed release cannot pass for this one.
  $signed = Get-Content (Join-Path $tmp "SHA256SUMS") | Where-Object { $_ -match "^# vargai cli-v(\S+)$" } | Select-Object -First 1
  if (-not $signed -or ($signed -replace "^# vargai cli-v", "") -ne $version) { throw "SHA256SUMS is not signed for $version" }
  Write-Host "signed by the varg release key (cli-v$version)" -ForegroundColor Green

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
