@echo off
title Push Standalone Exe to Git Release Branch
cd /d "%~dp0"

echo ========================================================
echo   Updating release-exe branch with QuizLearningPro.exe
echo ========================================================
echo.

if not exist "QuizLearningPro.exe" (
    echo [ERROR] QuizLearningPro.exe not found!
    echo Please run build first.
    pause
    exit /b 1
)

echo [1/5] Switching to branch release-exe...
git checkout release-exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to switch to release-exe branch.
    pause
    exit /b 1
)

echo [2/5] Merging latest updates from master...
git merge master -m "Merge master into release-exe"

echo [3/5] Force-staging latest binaries...
git add -f QuizLearningPro.exe WebView2Loader.dll

echo [4/5] Committing latest binary release...
git commit -m "release: update standalone QuizLearningPro.exe to latest version"

echo [5/5] Pushing to GitHub origin release-exe...
git push origin release-exe

echo.
echo Switching back to master branch...
git checkout master

echo.
echo ========================================================
echo   SUCCESS! Standalone exe branch updated on GitHub.
echo   Company clone command:
echo   git clone -b release-exe --single-branch https://github.com/BossKho/quiz_learning.git
echo ========================================================
pause
