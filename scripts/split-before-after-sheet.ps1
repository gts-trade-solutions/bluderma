param(
  [Parameter(Mandatory = $true)]
  [string]$Sheet,

  [Parameter(Mandatory = $true)]
  [string]$OutputRoot,

  [Parameter(Mandatory = $true)]
  [string[]]$Slugs,

  [string]$Version = "v1"
)

if ($Slugs.Count -lt 1 -or $Slugs.Count -gt 4) {
  throw "Pass between one and four treatment slugs."
}

Add-Type -AssemblyName System.Drawing

$resolvedSheet = (Resolve-Path -LiteralPath $Sheet).Path
$resolvedRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$workspaceRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)

if (-not $resolvedRoot.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputRoot must stay inside the current workspace."
}

$source = [System.Drawing.Bitmap]::FromFile($resolvedSheet)

try {
  $cellWidth = [int]($source.Width / 2)
  $cellHeight = [int]($source.Height / 2)
  $portraitWidth = [int]($cellWidth / 2)

  for ($index = 0; $index -lt $Slugs.Count; $index++) {
    $row = [int][Math]::Floor($index / 2)
    $column = $index % 2
    $cellX = $column * $cellWidth
    $cellY = $row * $cellHeight
    $targetDir = Join-Path $resolvedRoot $Slugs[$index]
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

    foreach ($side in @("before", "after")) {
      $sideOffset = if ($side -eq "before") { 0 } else { $portraitWidth }
      $rect = New-Object System.Drawing.Rectangle(
        ($cellX + $sideOffset),
        $cellY,
        $portraitWidth,
        $cellHeight
      )
      $crop = $source.Clone($rect, $source.PixelFormat)
      try {
        $output = Join-Path $targetDir "$side-$Version.png"
        $crop.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $crop.Dispose()
      }
    }
  }
} finally {
  $source.Dispose()
}
