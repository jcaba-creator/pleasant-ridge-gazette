@echo off
rem Automated Corridor Sweep - Redirects safely to Clean-Room Civic Edition
cd /d "%~dp0"

echo [%date% %time%] Redirecting sweep to clean civic edition... >> telemetry\sweep_execution.log

call "G:\My Drive\pleasant-ridge-gazette-public\Deploy_Civic_Gazette.bat" >> telemetry\sweep_execution.log 2>&1

echo [%date% %time%] Sweep completed successfully. >> telemetry\sweep_execution.log
