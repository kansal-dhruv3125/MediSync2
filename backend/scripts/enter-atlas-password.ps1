# Secure masked password entry for the MediSync2 Atlas connection.
# Run from the backend folder:  npm run enter-password
# - PowerShell Read-Host -AsSecureString: input never appears on screen
# - Auto URL-encoding for the MongoDB SRV URI
# - Writes ONLY into backend/.env (git-ignored); nothing is printed, logged or committed
$ErrorActionPreference = "Stop"

$envPath = Join-Path (Split-Path -Parent $PSCommandPath) "..\.env"
if (-not (Test-Path -LiteralPath $envPath)) {
  Write-Host "ERROR: backend/.env not found. Run this from the backend folder." -ForegroundColor Red
  exit 1
}

try {
  $plain = Read-Host -Prompt "Enter the Atlas DB password (input is hidden)" -AsSecureString | ForEach-Object {
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)
    try { [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  }
} catch {
  # Ctrl+C or host cancellation -> no changes
  Write-Host "Cancelled. backend/.env was NOT modified." -ForegroundColor Yellow
  exit 1
}

if ([string]::IsNullOrEmpty($plain)) {
  Write-Host "ERROR: no password entered. backend/.env was NOT modified." -ForegroundColor Red
  exit 1
}

# URL-encode for safe use in the mongodb+srv URI userinfo section
$encoded = [System.Uri]::EscapeDataString($plain)
foreach ($pair in @{ "'" = "%27"; "(" = "%28"; ")" = "%29"; "*" = "%2A"; "!" = "%21" }.GetEnumerator()) {
  $encoded = $encoded.Replace($pair.Key, $pair.Value)
}

# Look at the current .env content (do not display it anywhere)
$content = [System.IO.File]::ReadAllText($envPath)
$hadFinalNewline = $content.EndsWith("`n")
$lines = $content.TrimEnd("`n", "`r") -split "`r?`n"
$uriIndex = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i].StartsWith("MONGODB_URI=")) { $uriIndex = $i; break }
}
if ($uriIndex -lt 0) {
  Write-Host "ERROR: no MONGODB_URI line found in backend/.env. Nothing was modified." -ForegroundColor Red
  exit 1
}

$line = $lines[$uriIndex]
$action = ""
if ($line.Contains("<db_password>")) {
  $idx = $line.IndexOf("<db_password>")
  $lines[$uriIndex] = $line.Substring(0, $idx) + $encoded + $line.Substring($idx + "<db_password>".Length)
  $action = "replaced the <db_password> placeholder in the MONGODB_URI line"
} elseif ($line -match "^MONGODB_URI=mongodb\+srv://kansaldhruv3125_db_user:") {
  $colonIdx = $line.IndexOf(":", $line.IndexOf("://") + 3)
  $atIdx = $line.IndexOf("@")
  if ($colonIdx -ge 0 -and $atIdx -gt $colonIdx) {
    $lines[$uriIndex] = $line.Substring(0, $colonIdx + 1) + $encoded + $line.Substring($atIdx)
    $action = "updated the password stored in MONGODB_URI"
  }
}

if ($action -eq "") {
  Write-Host "ERROR: could not locate the placeholder or existing password in backend/.env. Nothing was modified." -ForegroundColor Red
  exit 1
}

$out = ($lines -join "`n") + $(if ($hadFinalNewline) { "`n" } else { "" })
[System.IO.File]::WriteAllText($envPath, $out)

Write-Host ""
Write-Host ("Done: backend/.env updated (git-ignored). {0}." -f $action) -ForegroundColor Green
Write-Host "The password was URL-encoded and never displayed."
exit 0
