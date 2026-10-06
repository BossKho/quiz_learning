@echo off
title Publish Official GitHub Release with Setup Exe
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_github_release.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Publishing GitHub Release failed.
)
pause
