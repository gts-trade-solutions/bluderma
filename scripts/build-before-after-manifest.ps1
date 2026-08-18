param(
  [string]$AuditCsv = ".\docs\hub-treatment-image-audit.csv",
  [string]$ImageRoot = ".\public\images\generated\treatments",
  [string]$Output = ".\prisma\generated-hub-before-after.json"
)

$rows = Import-Csv -LiteralPath $AuditCsv
$records = foreach ($row in $rows) {
  $version = if ($row.slug -in @(
    "skin-boosters",
    "profhilo-bioremodelling",
    "hydrafacial",
    "glutathione-brightening"
  )) { "v2" } else { "v1" }

  $beforeDisk = Join-Path $ImageRoot "$($row.slug)\before-$version.png"
  $afterDisk = Join-Path $ImageRoot "$($row.slug)\after-$version.png"

  if (-not (Test-Path -LiteralPath $beforeDisk) -or -not (Test-Path -LiteralPath $afterDisk)) {
    throw "Missing generated pair for $($row.category_slug)/$($row.slug)."
  }

  [ordered]@{
    type = "hubTreatment"
    categorySlug = $row.category_slug
    slug = $row.slug
    beforeAfter = [ordered]@{
      before = [ordered]@{
        source = "/images/generated/treatments/$($row.slug)/before-$version.png"
        alt = "$($row.treatment) illustrative before"
      }
      after = [ordered]@{
        source = "/images/generated/treatments/$($row.slug)/after-$version.png"
        alt = "$($row.treatment) illustrative after"
      }
    }
  }
}

$json = $records | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText(
  [System.IO.Path]::GetFullPath($Output),
  $json,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Output "Wrote $($records.Count) treatment pairs to $Output."
