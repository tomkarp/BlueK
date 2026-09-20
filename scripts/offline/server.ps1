# Static file server for the offline BlueK bundle, used when neither Node.js nor
# Python is installed. Uses only Windows on-board means (PowerShell 5.1+).
# Listens on 127.0.0.1 exclusively; one request per connection, then close.
param([int]$Port = 8901, [string]$Root = "")

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($Root)) { $Root = Join-Path $PSScriptRoot "app" }
if (-not (Test-Path -LiteralPath $Root)) { Write-Host "Ordner 'app' fehlt neben server.ps1."; exit 1 }
$root = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')

$types = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
  ".mjs" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"; ".svg" = "image/svg+xml"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"; ".ico" = "image/x-icon"; ".wasm" = "application/wasm"
  ".woff2" = "font/woff2"; ".map" = "application/json; charset=utf-8"
}

try {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
} catch {
  Write-Host "Port $Port konnte nicht geoeffnet werden ($($_.Exception.Message))."
  Write-Host "Starten Sie BlueK mit einem anderen Port, z. B.: start.bat $($Port + 1)"
  exit 1
}

Write-Host "BlueK: http://127.0.0.1:$Port/  (Fenster schliessen beendet BlueK)"
$ascii = [System.Text.Encoding]::ASCII

function Send-Response($stream, [int]$status, [string]$reason, [string]$type, [byte[]]$body) {
  $header = "HTTP/1.1 $status $reason`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = $ascii.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    # A browser may open a connection speculatively without sending a request;
    # the timeout keeps such a connection from blocking the next one for long.
    $client.ReceiveTimeout = 2000
    $client.SendTimeout = 30000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, $ascii)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
    $target = ($requestLine -split ' ')[1]
    if ([string]::IsNullOrWhiteSpace($target)) { $target = "/" }

    $relative = [System.Uri]::UnescapeDataString(($target -split '\?')[0])
    if ($relative.EndsWith("/")) { $relative += "index.html" }
    $file = Join-Path $root ($relative.TrimStart('/') -replace '/', '\')
    $full = [System.IO.Path]::GetFullPath($file)

    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $stream 403 "Forbidden" "text/plain; charset=utf-8" $ascii.GetBytes("Forbidden")
    } elseif (Test-Path -LiteralPath $full -PathType Leaf) {
      $extension = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $type = $types[$extension]
      if (-not $type) { $type = "application/octet-stream" }
      Send-Response $stream 200 "OK" $type ([System.IO.File]::ReadAllBytes($full))
    } else {
      Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" $ascii.GetBytes("Not found")
    }
  } catch {
    # A broken connection must never stop the server.
  } finally {
    $client.Close()
  }
}
