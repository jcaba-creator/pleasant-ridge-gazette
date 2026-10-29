@echo off
title The Pleasant Ridge Gazette - Production Workbench
color 0A

echo ========================================================
echo   THE PLEASANT RIDGE GAZETTE - PRODUCTION WORKBENCH
echo   USD 449 - Ft. Leavenworth - Leavenworth - Lansing
echo ========================================================
echo.
echo [1/2] Pulling real-time corridor fuel prices via GasBuddy feed...
if exist "%~dp0update_gas_feed.py" (
    python "%~dp0update_gas_feed.py"
)

echo.
echo [2/2] Launching Gazette Production Workbench in browser...
if exist "%~dp0editor.html" (
    start "" "%~dp0editor.html"
) else if exist "%~dp0pleasant_ridge_gazette.html" (
    start "" "%~dp0pleasant_ridge_gazette.html"
) else if exist "%~dp0index.html" (
    start "" "%~dp0index.html"
)

echo.
echo [READY] Gazette Production Workbench is open with live prices!
ping 127.0.0.1 -n 4 >nul
