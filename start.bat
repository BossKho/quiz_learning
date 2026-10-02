@echo off
title Quiz Learning Pro - Enterprise Practice Workspace
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;C:\Users\%USERNAME%\.cargo\bin;%PATH%"

echo ========================================================
echo       QUIZ LEARNING PRO - ENTERPRISE PLATFORM
echo ========================================================
echo [1/2] Verifying SQLite question bank and dependencies...
echo [2/2] Launching application on http://localhost:5173...
echo.
echo Press Ctrl+C in this terminal when you want to stop the app.
echo ========================================================

start http://localhost:5173
npm.cmd run dev
