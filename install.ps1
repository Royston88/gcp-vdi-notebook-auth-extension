# install.ps1
$ErrorActionPreference = "Stop"

# Ensure running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator because it installs to Program Files and registers in HKLM."
    Exit 1
}

$InstallDir = "C:\Program Files\Google\AuthenticationExtension"
$SourceDir = $PSScriptRoot

Write-Host "Installing GCP Authentication Extension Helper..." -ForegroundColor Cyan
Write-Host "Target Directory: $InstallDir"

# 1. Create directories
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}
$ExtensionDest = Join-Path $InstallDir "extension"
if (-not (Test-Path $ExtensionDest)) {
    New-Item -ItemType Directory -Path $ExtensionDest -Force | Out-Null
}

# 2. Copy files
Write-Host "Copying files..."
Copy-Item (Join-Path $SourceDir "src\native_host\*") -Destination $InstallDir -Force
Copy-Item (Join-Path $SourceDir "src\extension\*") -Destination $ExtensionDest -Recurse -Force

# 3. Register in HKLM (Requires Admin)
$ManifestPath = Join-Path $InstallDir "com.google.workbench.token_helper.json"
$RegistryPaths = @(
    "HKLM:\Software\Google\Chrome\NativeMessagingHosts\com.google.workbench.token_helper",
    "HKLM:\Software\Microsoft\Edge\NativeMessagingHosts\com.google.workbench.token_helper",
    "HKLM:\Software\Wow6432Node\Microsoft\Edge\NativeMessagingHosts\com.google.workbench.token_helper"
)

foreach ($RegPath in $RegistryPaths) {
    Write-Host "Registering at $RegPath ..."
    $Parent = Split-Path $RegPath -Parent
    if (-not (Test-Path $Parent)) {
        New-Item -Path $Parent -Force | Out-Null
    }
    if (-not (Test-Path $RegPath)) {
        New-Item -Path $RegPath -Force | Out-Null
    }
    Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ManifestPath
}

Write-Host "`nInstallation Complete!" -ForegroundColor Green
Write-Host "`nNext Steps for the user (Run Edge as normal user):" -ForegroundColor Yellow
Write-Host "1. Ensure you are logged in to gcloud CLI:"
Write-Host "   gcloud auth login --no-launch-browser"
Write-Host "2. Enable the extension in Microsoft Edge:"
Write-Host "   a. Open Microsoft Edge and navigate to: edge://extensions/"
Write-Host "   b. Toggle ON 'Developer mode' (bottom left or top right)."
Write-Host "   c. Click 'Load unpacked' button."
Write-Host "   d. Browse and select the folder:"
Write-Host "      $ExtensionDest"
Write-Host "3. Open your Vertex AI Workbench notebook link directly in Edge."
