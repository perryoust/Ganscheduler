# Setup Google Application Default Credentials for GanScheduler
# Usage:
#   .\setup-google-credentials.ps1 -Path 'C:\path\to\google-credentials.json'

param(
  [Parameter(Mandatory=$true)]
  [string]$Path
)

if (-not (Test-Path $Path)) {
  Write-Host "❌ File not found: $Path" -ForegroundColor Red
  exit 1
}

$resolved = Resolve-Path $Path
$envPath = $resolved.Path

Write-Host "✅ Found credentials file: $envPath" -ForegroundColor Green

Write-Host "Setting GOOGLE_APPLICATION_CREDENTIALS for current PowerShell session..."
$env:GOOGLE_APPLICATION_CREDENTIALS = $envPath
Write-Host "✔ Current session set to: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Green

Write-Host "Setting GOOGLE_APPLICATION_CREDENTIALS as user environment variable..."
[System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', $envPath, 'User')
Write-Host "✔ User environment variable set to: $envPath" -ForegroundColor Green

Write-Host "
הפעל שוב את PowerShell כדי שהשינויים יכנסו לתוקף בכל חלון חדש." -ForegroundColor Yellow
