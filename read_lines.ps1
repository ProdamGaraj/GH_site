$file = "c:\Users\d.tolkunov\CodeRepository\GH_site\visual-cms\frontend\src\pages\Editor.tsx"
$lines = [System.IO.File]::ReadAllLines($file)
Write-Host "Total lines: $($lines.Count)"
Write-Host "`n=== Lines 575-595 ==="
for ($i = 574; $i -lt 595 -and $i -lt $lines.Count; $i++) {
    Write-Host "$($i+1): $($lines[$i])"
}
Write-Host "`n=== Lines 723-730 ==="
for ($i = 722; $i -lt 730 -and $i -lt $lines.Count; $i++) {
    Write-Host "$($i+1): $($lines[$i])"
}
