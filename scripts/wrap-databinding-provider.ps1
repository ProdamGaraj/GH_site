# Script to wrap DndContext in DataBindingProvider in Editor.tsx
$file = "c:\Users\d.tolkunov\CodeRepository\GH_site\visual-cms\frontend\src\pages\Editor.tsx"

# Read file content
$content = [System.IO.File]::ReadAllText($file)

# First, let's output the lines around 580 and 728 to see what we're working with
$lines = $content -split "`n"
Write-Host "=== Lines 578-590 (0-indexed 577-589) ==="
for ($i = 577; $i -lt 590; $i++) {
    Write-Host "$($i+1): $($lines[$i])"
}
Write-Host ""
Write-Host "=== Lines 725-731 (0-indexed 724-730) ==="
for ($i = 724; $i -lt 731; $i++) {
    Write-Host "$($i+1): $($lines[$i])"
}
Write-Host ""

# Define the replacement patterns
# Pattern 1: After "return (" insert DataBindingProvider before DndContext
$oldPattern1 = "  return (`r`n    <DndContext"
$newPattern1 = "  return (`r`n    <DataBindingProvider pageId={id || 'new'}>`r`n      <DndContext"

$oldPattern1b = "  return (`n    <DndContext"
$newPattern1b = "  return (`n    <DataBindingProvider pageId={id || 'new'}>`n      <DndContext"

# Pattern 2: Close DataBindingProvider after DndContext
$oldPattern2 = "    </DndContext>`r`n  );"
$newPattern2 = "      </DndContext>`r`n    </DataBindingProvider>`r`n  );"

$oldPattern2b = "    </DndContext>`n  );"
$newPattern2b = "      </DndContext>`n    </DataBindingProvider>`n  );"

# Apply replacements
$newContent = $content
$replaced1 = $false
$replaced2 = $false

if ($newContent.Contains($oldPattern1)) {
    $newContent = $newContent.Replace($oldPattern1, $newPattern1)
    $replaced1 = $true
    Write-Host "Pattern 1 (CRLF) replaced"
} elseif ($newContent.Contains($oldPattern1b)) {
    $newContent = $newContent.Replace($oldPattern1b, $newPattern1b)
    $replaced1 = $true
    Write-Host "Pattern 1 (LF) replaced"
} else {
    Write-Host "Pattern 1 NOT found"
}

if ($newContent.Contains($oldPattern2)) {
    $newContent = $newContent.Replace($oldPattern2, $newPattern2)
    $replaced2 = $true
    Write-Host "Pattern 2 (CRLF) replaced"
} elseif ($newContent.Contains($oldPattern2b)) {
    $newContent = $newContent.Replace($oldPattern2b, $newPattern2b)
    $replaced2 = $true
    Write-Host "Pattern 2 (LF) replaced"
} else {
    Write-Host "Pattern 2 NOT found"
}

if ($replaced1 -and $replaced2) {
    # Write the file back
    [System.IO.File]::WriteAllText($file, $newContent)
    Write-Host ""
    Write-Host "=== File updated successfully ==="
} else {
    Write-Host ""
    Write-Host "=== Replacements not complete, file NOT updated ==="
}
