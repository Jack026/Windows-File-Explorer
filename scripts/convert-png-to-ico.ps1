Add-Type -AssemblyName System.Drawing
$pngPath = Resolve-Path "electron/icon.png"
$icoPath = [System.IO.Path]::Combine((Split-Path $pngPath), "icon.ico")

$img = [System.Drawing.Image]::FromFile($pngPath)
$bmp = New-Object System.Drawing.Bitmap $img, (New-Object System.Drawing.Size 256, 256)
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$stream = New-Object System.IO.FileStream $icoPath, ([System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$bmp.Dispose()
$img.Dispose()
Write-Output "ICO successfully created at $icoPath"
