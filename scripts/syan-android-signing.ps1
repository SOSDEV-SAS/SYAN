param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

function New-HexSecret {
  $bytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $generator.GetBytes($bytes)
  $generator.Dispose()
  return ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}

$privateDirectory = Join-Path $env:LOCALAPPDATA 'SYAN\android'
$keystorePath = Join-Path $privateDirectory 'syan-release.jks'
$credentialsPath = Join-Path $privateDirectory 'signing-credentials.json'
$propertiesPath = Join-Path $RepositoryRoot 'mobile\android\key.properties'

New-Item -ItemType Directory -Force -Path $privateDirectory | Out-Null

if (-not (Test-Path -LiteralPath $keystorePath)) {
  $storePassword = New-HexSecret
  $keyPassword = $storePassword
  $env:SYAN_ANDROID_STORE_PASSWORD = $storePassword
  $env:SYAN_ANDROID_KEY_PASSWORD = $keyPassword

  & keytool -genkeypair -keystore $keystorePath -storepass:env SYAN_ANDROID_STORE_PASSWORD -keypass:env SYAN_ANDROID_KEY_PASSWORD -alias syan -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=S&AN, OU=Mobile, O=SOSDEV, L=Bogota, ST=Cundinamarca, C=CO'
  if ($LASTEXITCODE -ne 0) {
    throw 'No fue posible generar la clave de firma de Android.'
  }

  $credentials = [ordered]@{
    keyAlias = 'syan'
    keyPassword = $keyPassword
    storePassword = $storePassword
  }
  [System.IO.File]::WriteAllText($credentialsPath, ($credentials | ConvertTo-Json))
  & icacls $credentialsPath /inheritance:r /grant:r "$env:USERNAME`:F" | Out-Null
  & icacls $keystorePath /inheritance:r /grant:r "$env:USERNAME`:F" | Out-Null
}

if (-not (Test-Path -LiteralPath $credentialsPath)) {
  throw "Faltan las credenciales privadas de firma en $credentialsPath"
}

$credentials = Get-Content -Raw -LiteralPath $credentialsPath | ConvertFrom-Json
$normalizedKeystorePath = $keystorePath.Replace('\', '/')
$properties = @(
  "storePassword=$($credentials.storePassword)"
  "keyPassword=$($credentials.storePassword)"
  "keyAlias=$($credentials.keyAlias)"
  "storeFile=$normalizedKeystorePath"
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($propertiesPath, $properties)

Write-Output "Firma Android configurada en $keystorePath"
