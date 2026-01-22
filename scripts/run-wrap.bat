@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "c:\Users\d.tolkunov\CodeRepository\GH_site\scripts\wrap-databinding-provider.ps1"
echo.
echo === Verifying DataBindingProvider occurrences ===
findstr /n "DataBindingProvider" "c:\Users\d.tolkunov\CodeRepository\GH_site\visual-cms\frontend\src\pages\Editor.tsx"
