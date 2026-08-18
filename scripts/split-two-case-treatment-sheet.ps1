param(
  [Parameter(Mandatory = $true)]
  [string]$Sheet,

  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,

  [string]$Version = "v1"
)

Add-Type -AssemblyName System.Drawing

$resolvedSheet = (Resolve-Path -LiteralPath $Sheet).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$workspaceRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)

if (-not $resolvedOutput.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputDirectory must stay inside the current workspace."
}

New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$source = [System.Drawing.Bitmap]::FromFile($resolvedSheet)

try {
  $rowHeight = [int]($source.Height / 2)
  $halfWidth = [int]($source.Width / 2)
  $portraitWidth = [int]($rowHeight * 0.8)
  $horizontalInset = [int](($halfWidth - $portraitWidth) / 2)

  for ($caseIndex = 0; $caseIndex -lt 2; $caseIndex++) {
    foreach ($side in @("before", "after")) {
      $halfOffset = if ($side -eq "before") { 0 } else { $halfWidth }
      $rect = New-Object System.Drawing.Rectangle(
        ($halfOffset + $horizontalInset),
        ($caseIndex * $rowHeight),
        $portraitWidth,
        $rowHeight
      )
      $crop = $source.Clone($rect, $source.PixelFormat)
      try {
        $output = Join-Path $resolvedOutput "case-$($caseIndex + 1)-$side-$Version.png"
        $crop.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $crop.Dispose()
      }
    }
  }
} finally {
  $source.Dispose()
}
