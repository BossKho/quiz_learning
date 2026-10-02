@echo off
title Quiz Learning Pro - Enterprise Platform
cd /d "%~dp0"

if exist "QuizLearningPro.exe" (
    echo Launching native Windows application: QuizLearningPro.exe...
    start "" "QuizLearningPro.exe"
    exit /b
)

echo QuizLearningPro.exe not found, falling back to dev server...
set "PATH=C:\Program Files\nodejs;C:\Users\%USERNAME%\.cargo\bin;%PATH%"
start http://localhost:5173
npm.cmd run dev
