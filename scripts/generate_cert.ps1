$ErrorActionPreference = 'Stop'

if (!(Test-Path 'build')) {
    New-Item -ItemType Directory -Path 'build' | Out-Null
}

$certPass = 'SmartExplorer2026!'
$secPassword = ConvertTo-SecureString -String $certPass -Force -AsPlainText

Write-Host "Generating Code Signing Certificate for Jack026..."
$codeCert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=Jack026, O=Windows File Explorer, C=US" `
    -KeyUsage DigitalSignature `
    -FriendlyName "Windows File Explorer Code Signing" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(5)

$pfxPath = "build\certificate.pfx"
$cerPath = "build\certificate.cer"

Write-Host "Exporting PFX to $pfxPath..."
Export-PfxCertificate -Cert $codeCert -FilePath $pfxPath -Password $secPassword | Out-Null

Write-Host "Exporting CER to $cerPath..."
Export-Certificate -Cert $codeCert -FilePath $cerPath | Out-Null

Write-Host "Installing certificate to Trusted Root and Trusted Publisher stores..."
Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher" | Out-Null

Write-Host "Certificate successfully generated and trusted!"
Write-Host "Thumbprint: $($codeCert.Thumbprint)"
