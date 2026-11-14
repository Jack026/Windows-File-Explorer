Add-Type -AssemblyName System.Drawing
[System.IO.Directory]::CreateDirectory('electron')
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background Violet gradient
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 256, 256), ([System.Drawing.Color]::FromArgb(139, 92, 246)), ([System.Drawing.Color]::FromArgb(79, 70, 229))
$g.FillRectangle($brush, 0, 0, 256, 256)

# Drive outline
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 12
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$g.DrawRectangle($pen, 40, 60, 176, 136)
$g.DrawLine($pen, 40, 140, 216, 140)

# Activity LED
$ledBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(52, 211, 153))
$g.FillEllipse($ledBrush, 175, 160, 16, 16)

$bmp.Save('electron/icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Icon created successfully"
