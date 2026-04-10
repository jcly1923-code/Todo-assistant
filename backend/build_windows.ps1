# Build AITodoApp for Windows (run in PowerShell from repo root or from backend/).
# Requires: Node.js, npm, Python 3.10+ on PATH, and a Windows environment
# (PyInstaller produces Windows binaries when run on Windows).

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $RepoRoot "frontend"))) {
    $RepoRoot = $PSScriptRoot
}
Set-Location $RepoRoot

Write-Host "Building frontend..."
Push-Location (Join-Path $RepoRoot "frontend")
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

Write-Host "Installing PyInstaller + backend deps..."
Push-Location (Join-Path $RepoRoot "backend")
python -m pip install -r requirements-build.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running PyInstaller..."
pyinstaller --noconfirm todo-app.spec
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

$Out = Join-Path $RepoRoot "backend\dist\AITodoApp"
Write-Host "Done. Output folder: $Out"
Write-Host "Run AITodoApp.exe inside that folder (keeps bundled DLLs next to the exe)."
