@echo off
rem Automated Corridor Sweep (GasBuddy 5 AM & 3 PM, AAR Telemetry, Live Deploy)
cd /d "%~dp0"

set LOGFILE="%~dp0telemetry\sweep_execution.log"
echo [%date% %time%] Initiating Scheduled Sweep... >> %LOGFILE%

python "%~dp0update_gas_feed.py" >> %LOGFILE% 2>&1
python "%~dp0record_telemetry.py" >> %LOGFILE% 2>&1

copy /Y "%~dp0gas_prices.json" "%~dp0public\gas_prices.json" >nul 2>&1
copy /Y "%~dp0gas_prices.js" "%~dp0public\gas_prices.js" >nul 2>&1
copy /Y "%~dp0index.html" "%~dp0public\index.html" >nul 2>&1

rem Deploy to Vercel Edge with scope
call vercel deploy --prod --yes --scope billow-and-breeze . >> %LOGFILE% 2>&1

echo [%date% %time%] Sweep completed and published to Vercel. >> %LOGFILE%
