# Script to publish a clean, code-free release-exe branch containing ONLY QuizLearningPro_Setup.exe + README.md
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$exePath = Join-Path $scriptDir "QuizLearningPro_Setup.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "[ERROR] QuizLearningPro_Setup.exe not found at $exePath! Please build first."
    exit 1
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Updating clean release-exe branch (No source code)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Read package version if available
$version = "1.3.0"
$packageJsonPath = Join-Path $scriptDir "package.json"
if (Test-Path $packageJsonPath) {
    try {
        $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        if ($pkg.version) { $version = $pkg.version }
    } catch {}
}

Write-Host "Packaging version: v$version" -ForegroundColor Green

# 2. Hash executable
$exeBlob = (git hash-object -w "QuizLearningPro_Setup.exe").Trim()

# 3. Create README.md blob
$readmeContent = @"
# Quiz Learning Pro - Release Executable

Bản cài đặt chính thức của ứng dụng **Quiz Learning Pro** (v$version).

### Hướng dẫn cài đặt & sử dụng:
1. Nhấp đúp chuột vào file `QuizLearningPro_Setup.exe` để tiến hành cài đặt.
2. Trình cài đặt sẽ tự động thiết lập ứng dụng và tạo biểu tượng trên Desktop / Start Menu.
3. Mở ứng dụng và đăng nhập tài khoản để tự động đồng bộ toàn bộ tiến trình học tập từ đám mây (Cloud Sync).

---
*Ghi chú: Nhánh `release-exe` được tối ưu hóa chỉ chứa duy nhất bộ cài đặt, giúp tải nhanh gọn trong môi trường công ty mà không kèm mã nguồn.*
"@

$tempReadme = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempReadme, $readmeContent, [System.Text.Encoding]::UTF8)
    $readmeBlob = (git hash-object -w $tempReadme).Trim()
} finally {
    if (Test-Path $tempReadme) { Remove-Item $tempReadme -Force }
}

# 4. Construct tree in an isolated index (does not affect current working directory or master index)
$tempIndex = [System.IO.Path]::GetTempFileName()
if (Test-Path $tempIndex) { Remove-Item $tempIndex -Force }

try {
    $env:GIT_INDEX_FILE = $tempIndex
    git update-index --add --cacheinfo 100644,$exeBlob,QuizLearningPro_Setup.exe
    git update-index --add --cacheinfo 100644,$readmeBlob,README.md
    $treeId = (git write-tree).Trim()
    
    $commitMsg = "release: QuizLearningPro_Setup.exe (v$version) standalone installer"
    $commitId = (git commit-tree $treeId -m $commitMsg).Trim()
    
    git update-ref refs/heads/release-exe $commitId
    Write-Host "Created orphan commit $commitId on branch release-exe" -ForegroundColor Green
} finally {
    if (Test-Path $tempIndex) { Remove-Item $tempIndex -Force }
    Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue
}

# 5. Push to GitHub
Write-Host "Pushing release-exe to origin..." -ForegroundColor Yellow
git push -f origin release-exe

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SUCCESS! Clean release-exe branch updated on GitHub." -ForegroundColor Green
Write-Host "  Contains ONLY QuizLearningPro_Setup.exe and README.md" -ForegroundColor Green
Write-Host ""
Write-Host "  Command to clone on company PC:" -ForegroundColor Yellow
Write-Host "  git clone -b release-exe --single-branch https://github.com/BossKho/quiz_learning.git" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
