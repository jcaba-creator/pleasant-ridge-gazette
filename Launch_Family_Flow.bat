@echo off
title The Pleasant Ridge Gazette - Family Flow Simulator & Routine Trainer
color 0E

echo ===================================================================
echo   THE PLEASANT RIDGE GAZETTE: FAMILY FLOW SIMULATOR
echo   USD 449 Pleasant Ridge - Easton - Leavenworth County, KS
echo ===================================================================
echo.
echo Launching Family Flow Simulator & Routine Trainer in browser...
if exist "%~dp0family_flow.html" (
    start "" "%~dp0family_flow.html"
) else if exist "%~dp0public\family_flow.html" (
    start "" "%~dp0public\family_flow.html"
)

echo.
echo [READY] Family Flow Simulator is active!
ping 127.0.0.1 -n 3 >nul
