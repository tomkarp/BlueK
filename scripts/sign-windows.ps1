param([Parameter(Mandatory = $true)][string]$File)

$ErrorActionPreference = "Stop"
$thumbprint = $env:BLUEK_WINDOWS_CERTIFICATE_THUMBPRINT
if ([string]::IsNullOrWhiteSpace($thumbprint)) {
  Write-Host "BlueK Windows signing certificate is not configured; leaving this local build unsigned."
  exit 0
}

$timestamp = $env:BLUEK_WINDOWS_TIMESTAMP_URL
if ([string]::IsNullOrWhiteSpace($timestamp)) {
  $timestamp = "http://timestamp.digicert.com"
}
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $signtool) { throw "Windows SDK signtool.exe was not found." }
& $signtool sign /sha1 $thumbprint /fd SHA256 /tr $timestamp /td SHA256 $File
if ($LASTEXITCODE -ne 0) { throw "signtool.exe failed with exit code $LASTEXITCODE." }
