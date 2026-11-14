$regKeys = @(
  @{ Path = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'; Type = 'registry_x64' },
  @{ Path = 'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'; Type = 'registry_x86' },
  @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'; Type = 'registry_user' }
)

$results = [System.Collections.Generic.List[PSObject]]::new()

foreach ($key in $regKeys) {
  try {
    $items = Get-ItemProperty -Path $key.Path -ErrorAction SilentlyContinue
    foreach ($item in $items) {
      if ($item.DisplayName -and -not $item.ParentKeyName -and $item.SystemComponent -ne 1) {
        $results.Add([PSCustomObject]@{
          DisplayName          = $item.DisplayName
          DisplayVersion      = $item.DisplayVersion
          Publisher            = $item.Publisher
          InstallDate          = $item.InstallDate
          InstallLocation      = $item.InstallLocation
          UninstallString      = $item.UninstallString
          QuietUninstallString = $item.QuietUninstallString
          DisplayIcon          = $item.DisplayIcon
          EstimatedSize        = $item.EstimatedSize
          Type                 = $key.Type
        })
      }
    }
  } catch {}
}

try {
  $appx = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { -not $_.IsFramework -and $_.NonRemovable -ne $true }
  foreach ($pkg in $appx) {
    if ($pkg.Name -and -not $pkg.Name.StartsWith("Microsoft.VCLibs") -and -not $pkg.Name.StartsWith("Microsoft.UI.Xaml")) {
      $results.Add([PSCustomObject]@{
        DisplayName          = $pkg.Name
        DisplayVersion      = $pkg.Version
        Publisher            = $pkg.Publisher
        InstallDate          = $null
        InstallLocation      = $pkg.InstallLocation
        UninstallString      = "Remove-AppxPackage -Package `"$($pkg.PackageFullName)`""
        QuietUninstallString = "Remove-AppxPackage -Package `"$($pkg.PackageFullName)`""
        DisplayIcon          = $null
        EstimatedSize        = $null
        Type                 = 'msix_appx'
      })
    }
  }
} catch {}

$results | ConvertTo-Json -Compress
