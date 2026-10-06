# Script to create and publish official GitHub Release with attached QuizLearningPro_Setup.exe
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Ensure gh.exe is found in PATH
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
    if (Test-Path (Join-Path $cargoBin "gh.exe")) {
        $env:PATH = "$cargoBin;$env:PATH"
    } else {
        Write-Error "[ERROR] GitHub CLI (gh.exe) khong ton tai. Vui long cai dat gh CLI."
        exit 1
    }
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   XUAT BAN GITHUB RELEASE (Official Releases Page)    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Kiem tra trang thai dang nhap gh
Write-Host "Dang kiem tra quyen truy cap GitHub..." -ForegroundColor Yellow
cmd.exe /c "gh auth status >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[!] Ban chua dang nhap GitHub tren CLI." -ForegroundColor Yellow
    Write-Host "    Dang khoi dong dang nhap web (chi can lam 1 lan duy nhat)..." -ForegroundColor Cyan
    Write-Host "    Trinh duyet se mo ra, hay nhap ma xac nhan duoc hien thi tren man hinh." -ForegroundColor White
    Write-Host ""
    
    gh auth login --web -h github.com -p https
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[ERROR] Dang nhap GitHub that bai."
        exit 1
    }
}

Write-Host "[OK] Da dang nhap GitHub thanh cong!" -ForegroundColor Green

# 2. Doc phien ban tu package.json
$version = "1.3.0"
$packageJsonPath = Join-Path $scriptDir "package.json"
if (Test-Path $packageJsonPath) {
    try {
        $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        if ($pkg.version) { $version = $pkg.version }
    } catch {}
}

$tag = "v$version"
$releaseTitle = "Ver 1.30 - Bo nap de thi thong minh"

# 3. Kiem tra file setup
$setupFile = Join-Path $scriptDir "QuizLearningPro_Setup.exe"
if (-not (Test-Path $setupFile)) {
    Write-Error "[ERROR] Khong tim thay file $setupFile! Vui long build app truoc."
    exit 1
}

$fileItem = Get-Item $setupFile
$fileSizeMb = [math]::Round($fileItem.Length / 1MB, 2)
$sha256 = (Get-FileHash $setupFile -Algorithm SHA256).Hash.ToUpper()

# Tao file checksum sha256
$sha256File = Join-Path $scriptDir "QuizLearningPro_Setup.exe.sha256"
Set-Content -Path $sha256File -Value "$sha256  QuizLearningPro_Setup.exe" -Encoding ASCII

Write-Host ""
Write-Host "Thong tin phat hanh:" -ForegroundColor Cyan
Write-Host "  - Phien ban : $version (Tag: $tag)" -ForegroundColor White
Write-Host "  - Tieu de   : $releaseTitle" -ForegroundColor White
Write-Host "  - File setup: QuizLearningPro_Setup.exe ($fileSizeMb MB)" -ForegroundColor White
Write-Host "  - SHA-256   : $sha256" -ForegroundColor White
Write-Host ""

# 4. Kiem tra file notes
$notesFile = Join-Path $scriptDir "RELEASE_NOTES.md"
if (-not (Test-Path $notesFile)) {
    $notesFile = $setupFile # fallback
}

# 5. Kiem tra xem Release da ton tai chua, neu co thi update asset, neu chua thi tao moi
Write-Host "Dang tao GitHub Release va upload QuizLearningPro_Setup.exe..." -ForegroundColor Yellow

cmd.exe /c "gh release view $tag >nul 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Release $tag da ton tai tren GitHub. Dang cap nhat file asset..." -ForegroundColor Yellow
    gh release upload $tag "QuizLearningPro_Setup.exe" "$sha256File" --clobber
    gh release edit $tag --title $releaseTitle --notes-file $notesFile
} else {
    gh release create $tag "QuizLearningPro_Setup.exe" "$sha256File" --title $releaseTitle --notes-file $notesFile
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "   THANH CONG! GitHub Release da duoc xuat ban!         " -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "Xem Release tai: https://github.com/BossKho/quiz_learning/releases/tag/$tag" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Error "[ERROR] Tao GitHub Release that bai."
}
