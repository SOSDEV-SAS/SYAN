param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$')]
  [string] $ServerTailscaleAddress
)

$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script from an elevated PowerShell session.'
}

$storageRoot = 'D:\SYAN\storage'
$libraryRoot = 'D:\SYAN\library'
$accountName = 'syan-storage'
$qualifiedAccountName = "$env:COMPUTERNAME\$accountName"
$tailscaleExecutable = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
$storageHost = (& $tailscaleExecutable ip -4 | Select-Object -First 1).Trim()
if (-not $storageHost) {
  throw 'Tailscale does not have an IPv4 address.'
}

$randomBytes = New-Object byte[] 30
$randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$randomNumberGenerator.GetBytes($randomBytes)
$randomNumberGenerator.Dispose()
$password = [Convert]::ToBase64String($randomBytes)
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$account = Get-LocalUser -Name $accountName -ErrorAction SilentlyContinue
if ($account) {
  Set-LocalUser -Name $accountName -Password $securePassword -PasswordNeverExpires $true
  Enable-LocalUser -Name $accountName
} else {
  New-LocalUser -Name $accountName -Password $securePassword -PasswordNeverExpires -AccountNeverExpires | Out-Null
}

New-Item -ItemType Directory -Path $storageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $libraryRoot -Force | Out-Null
& icacls.exe $storageRoot /grant "${qualifiedAccountName}:(OI)(CI)M" | Out-Null
& icacls.exe $libraryRoot /grant "${qualifiedAccountName}:(OI)(CI)RX" | Out-Null

foreach ($shareName in @('SYAN_STORAGE', 'SYAN_LIBRARY')) {
  $existingShare = Get-SmbShare -Name $shareName -ErrorAction SilentlyContinue
  if ($existingShare) {
    Remove-SmbShare -Name $shareName -Force
  }
}

New-SmbShare -Name 'SYAN_STORAGE' -Path $storageRoot -FullAccess $qualifiedAccountName -EncryptData $true -FolderEnumerationMode AccessBased -CachingMode None | Out-Null
New-SmbShare -Name 'SYAN_LIBRARY' -Path $libraryRoot -ReadAccess $qualifiedAccountName -EncryptData $true -FolderEnumerationMode AccessBased -CachingMode None | Out-Null

$firewallRuleName = 'SYAN Storage over Tailscale'
Remove-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 445 -RemoteAddress $ServerTailscaleAddress -Profile Any | Out-Null

$privateDirectory = Join-Path $env:LOCALAPPDATA 'SYAN'
$credentialPath = Join-Path $privateDirectory 'storage-credentials.json'
New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
@{
  host = $storageHost
  username = $accountName
  password = $password
} | ConvertTo-Json | Set-Content -LiteralPath $credentialPath -Encoding utf8
& icacls.exe $credentialPath /inheritance:r /grant:r "${env:USERNAME}:(R,W)" 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null

Write-Host "S&AN storage is ready at $storageHost. Credentials were saved to $credentialPath."
