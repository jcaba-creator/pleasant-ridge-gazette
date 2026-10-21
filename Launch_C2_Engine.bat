@echo off
title The Pleasant Ridge Gazette - Household C2 & Wargaming Engine
color 0E

echo ========================================================
echo   THE PLEASANT RIDGE GAZETTE: HOUSEHOLD C2 ENGINE
echo   USD 449 Easton - Fort Leavenworth - Lansing Corridor
echo ========================================================
echo.
echo Launching C2 & Stochastic Wargaming Engine in browser...
if exist "%~dp0c2.html" (
    start "" "%~dp0c2.html"
) else if exist "%~dp0index.html" (
    start "" "%~dp0index.html"
)

echo.
echo [OPERATIONAL] C2 Command Interface is running!
ping 127.0.0.1 -n 3 >nul
