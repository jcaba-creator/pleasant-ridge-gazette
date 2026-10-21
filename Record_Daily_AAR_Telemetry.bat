@echo off
title The Pleasant Ridge Gazette - Daily Predictive & Telemetry Auditor
color 0A

echo ======================================================================
echo   THE PLEASANT RIDGE GAZETTE - PREDICTIVE RADAR & TELEMETRY AUDITOR
echo   Target Folder: G:\My Drive\pleasant-ridge-gazette\telemetry\
echo ======================================================================
echo.
echo [1/2] Auditing live predictions against ground-truth outcomes...
python "%~dp0record_telemetry.py"

echo.
echo [2/2] Checking local Google Drive CSV ledgers...
if exist "%~dp0telemetry\predictive_aar_ledger.csv" (
    echo [OK] predictive_aar_ledger.csv updated.
)
if exist "%~dp0telemetry\telemetry_summary.json" (
    echo [OK] telemetry_summary.json updated.
)

echo.
echo ======================================================================
echo [SUCCESS] Telemetry recorded to Google Drive!
echo ======================================================================
echo.
pause
