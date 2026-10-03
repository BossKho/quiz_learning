@echo off
title Push Clean Setup Exe to Git Release Branch
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_release_branch.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Publishing release failed.
)
pause
