param(
  [string]$AuditCsv = ".\docs\hub-treatment-image-audit.csv",
  [string]$ImageRoot = ".\public\images\generated\before-after",
  [string]$Output = ".\prisma\generated-hub-before-after-all.json"
)

$records = foreach ($row in (Import-Csv -LiteralPath $AuditCsv)) {
  $relativeRoot = "$($row.category_slug)/$($row.slug)"
  $diskRoot = Join-Path $ImageRoot $relativeRoot
  $pairs = foreach ($caseIndex in 1..2) {
    $beforeDisk = Join-Path $diskRoot "case-$caseIndex-before-v1.png"
    $afterDisk = Join-Path $diskRoot "case-$caseIndex-after-v1.png"
    if (-not (Test-Path -LiteralPath $beforeDisk) -or -not (Test-Path -LiteralPath $afterDisk)) {
      throw "Missing generated case $caseIndex for $($row.category_slug)/$($row.slug)."
    }

    [ordered]@{
      before = [ordered]@{
        source = "/images/generated/before-after/$relativeRoot/case-$caseIndex-before-v1.png"
        alt = "$($row.treatment) illustrative case $caseIndex before"
      }
      after = [ordered]@{
        source = "/images/generated/before-after/$relativeRoot/case-$caseIndex-after-v1.png"
        alt = "$($row.treatment) illustrative case $caseIndex after"
      }
    }
  }

  [ordered]@{
    type = "hubTreatment"
    categorySlug = $row.category_slug
    slug = $row.slug
    beforeAfterCases = @($pairs)
  }
}

$json = $records | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText(
  [System.IO.Path]::GetFullPath($Output),
  $json,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Output "Wrote $($records.Count) treatments with two cases each to $Output."
