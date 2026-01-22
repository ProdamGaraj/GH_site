# Script to wrap DndContext in DataBindingProvider in Editor.tsx
$file = "c:\Users\d.tolkunov\CodeRepository\GH_site\visual-cms\frontend\src\pages\Editor.tsx"
$content = [System.IO.File]::ReadAllText($file)

# Replace the return with DataBindingProvider wrapper
$oldStart = "  return (
    <DndContext 
      sensors={sensors}"
$newStart = "  return (
    <DataBindingProvider pageId={id || 'new'}>
      <DndContext 
        sensors={sensors}"

$content = $content.Replace($oldStart, $newStart)

# Replace the closing tag
$oldEnd = "    </DndContext>
  );"
$newEnd = "      </DndContext>
    </DataBindingProvider>
  );"

$content = $content.Replace($oldEnd, $newEnd)

[System.IO.File]::WriteAllText($file, $content)

Write-Host "Done! Checking changes..."
Select-String -Path $file -Pattern "DataBindingProvider" | ForEach-Object { "$($_.LineNumber): $($_.Line)" }
