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
$authCheck = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[!] Ban chua dang nhap GitHub tren CLI." -ForegroundColor Yellow
    Write-Host "    Dang khoi dong dang nhap web (chi can lam 1 lan duy nhat)..." -ForegroundColor Cyan
    Write-Host "    Trinh duyet se mo ra, hay nhap ma xac nhan duoc hien thi." -ForegroundColor White
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
# Chuyen 1.3.0 -> 1.30 cho tieu de de phu hop format quen thuoc Ver 1.30
$titleVersion = $version -replace '\.0$', '0' -replace '\.', '.'
$releaseTitle = "Ver 1.30 — Bo nap de thi thong minh"

# 3. Kiem tra file setup
$setupFile = Join-Path $scriptDir "QuizLearningPro_Setup.exe"
if (-not (Test-Path $setupFile)) {
    Write-Error "[ERROR] Khong tim thay file $setupFile! Vui long build app truoc."
    exit 1
}

$fileSizeMb = [math]::Round((Get-Item $setupFile).Length / 1MB, 2)
Write-Host ""
Write-Host "Thong tin phat hanh:" -ForegroundColor Cyan
Write-Host "  - Phien ban : $version (Tag: $tag)" -ForegroundColor White
Write-Host "  - Tieu de   : $releaseTitle" -ForegroundColor White
Write-Host "  - Tep dinh kem: QuizLearningPro_Setup.exe ($fileSizeMb MB)" -ForegroundColor White
Write-Host ""

# 4. Noi dung ghi chu Release
$releaseNotes = @"
## Quiz Learning Pro v$version — Bản cập nhật Bộ nạp đề thi thông minh

### Các tính năng & Cải tiến mới:
- 📋 **Nhập đề trực tiếp bằng văn bản (Text to Quiz):** Cho phép copy/paste đề thi trực tiếp từ Word, PDF, Web mà không cần phải tự tạo cấu trúc JSON phức tạp.
- 🧠 **Bộ phân tích Rule-based thuần Offline:**
  - Nhận diện linh hoạt tiền tố câu hỏi tiếng Việt (\`Câu 1:\`, \`1.\`, \`2)\`).
  - Hỗ trợ đa dạng định dạng phương án (\`A.\`, \`A)\`, \`[A]\`, \`(A)\`, câu Đúng/Sai, đề 5 phương án A-E).
  - Tự động nhận diện đáp án hoa thị (\`*A.\`), nhãn inline (\`Đáp án: A, C\`), và bóc tách bảng đáp án chân trang.
  - Cơ chế Safe Buffer Continuation bảo toàn trọn vẹn văn bản bị ngắt dòng do copy từ PDF.
  - Phát hiện xung đột đáp án, tuyệt đối không đoán mò khi dữ liệu mơ hồ.
- 🛡️ **Quy trình kiểm duyệt & Biên tập 2 bước:**
  - Bộ lọc trực quan: \`Tất cả\`, \`Hợp lệ\`, \`Cần kiểm tra\`.
  - Phím bấm gán nhanh đáp án \`[A] [B] [C] [D]\` ngay trên danh sách.
  - Cho phép sửa trực tiếp nội dung câu hỏi/phương án trước khi lưu vào SQLite.
- 🧪 **Kiểm thử tự động:** Đạt 100% 43 test cases tự động (18 test cases chuyên sâu cho parser).

### Hướng dẫn cài đặt:
1. Tải file **QuizLearningPro_Setup.exe** bên dưới mục Assets.
2. Chạy bộ cài để tự động cập nhật phiên bản mới.
"@

# 5. Kiem tra xem Release da ton tai chua, neu co thi update asset, neu chua thi tao moi
Write-Host "Dang tao GitHub Release va upload QuizLearningPro_Setup.exe..." -ForegroundColor Yellow

# Ghi notes ra file tam thoi (UTF-8 khong BOM)
$tempNotes = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempNotes, $releaseNotes, [System.Text.Encoding]::UTF8)
    
    # Kiem tra release da co tren remote chua
    $existingRelease = gh release view $tag 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Release $tag da ton tai tren GitHub. Dang cap nhat file asset..." -ForegroundColor Yellow
        gh release upload $tag "QuizLearningPro_Setup.exe" --clobber
        gh release edit $tag --title $releaseTitle --notes-file $tempNotes
    } else {
        # Tao release moi
        gh release create $tag "QuizLearningPro_Setup.exe" --title $releaseTitle --notes-file $tempNotes
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
} finally {
    if (Test-Path $tempNotes) { Remove-Item $tempNotes -Force }
}
