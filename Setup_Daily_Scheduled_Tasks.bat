@echo off
title Setup Pleasant Ridge Gazette Daily Sweeps (5 AM & 3 PM)
color 0B
echo ========================================================
echo   CONFIGURING AUTOMATED CORRIDOR SWEEP SCHEDULE
echo   GasBuddy: 5:00 AM & 3:00 PM Daily
echo   Script: Run_Corridor_Sweep.bat
echo ========================================================
echo.

schtasks.exe /create /tn "PleasantRidgeGazette_MorningSweep_5AM" /tr "\"%~dp0Run_Corridor_Sweep.bat\"" /sc daily /st 05:00 /f
echo.
schtasks.exe /create /tn "PleasantRidgeGazette_AfternoonSweep_3PM" /tr "\"%~dp0Run_Corridor_Sweep.bat\"" /sc daily /st 15:00 /f

echo.
echo ========================================================
echo [SUCCESS] Windows Scheduled Tasks Registered!
echo   - 5:00 AM Daily: PleasantRidgeGazette_MorningSweep_5AM
echo   - 3:00 PM Daily: PleasantRidgeGazette_AfternoonSweep_3PM
echo ========================================================
pause
