$exePath = Resolve-Path "release\Windows-File-Explorer-win-x64\Windows File Explorer.exe"
Write-Host "Testing binary: $exePath"
$process = Start-Process -FilePath $exePath -PassThru
Start-Sleep -Seconds 4
$alive = (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) -ne $null
Write-Host "Process running: $alive (PID: $($process.Id))"
Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Name "*Windows File Explorer*" -Force -ErrorAction SilentlyContinue
Write-Host "Launch verification complete."
