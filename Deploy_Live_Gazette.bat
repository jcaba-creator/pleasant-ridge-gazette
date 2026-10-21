@echo off
title Deploy The Pleasant Ridge Gazette and 449 Field Arcade
color 0A

echo ========================================================
echo   DEPLOYING THE PLEASANT RIDGE GAZETTE and 449 ARCADE
echo   Target: https://pleasant-ridge-gazette.vercel.app
echo ========================================================
echo.
echo [1/3] Updating live corridor fuel prices...
python "%~dp0update_gas_feed.py"

copy /Y "%~dp0gas_prices.json" "%~dp0public\gas_prices.json" >nul 2>&1
copy /Y "%~dp0gas_prices.js" "%~dp0public\gas_prices.js" >nul 2>&1
copy /Y "%~dp0index.html" "%~dp0public\index.html" >nul 2>&1
if not exist "%~dp0public\data" mkdir "%~dp0public\data"
xcopy /Y /Q /E "%~dp0data\*.*" "%~dp0public\data\" >nul 2>&1

echo.
echo [2/3] Syncing 449 Field Arcade modules...
if not exist "%~dp0arcade" mkdir "%~dp0arcade"
if not exist "%~dp0public\arcade" mkdir "%~dp0public\arcade"
xcopy /Y /Q /E "G:\My Drive\449-arcade\*.*" "%~dp0arcade\"
xcopy /Y /Q /E "G:\My Drive\449-arcade\*.*" "%~dp0public\arcade\"
copy /Y "%~dp0arcade\breaker_vault.html" "%~dp0public\breaker_vault.html" >nul 2>&1
if not exist "%~dp0public\ops" mkdir "%~dp0public\ops"
xcopy /Y /Q /E "%~dp0ops\*.*" "%~dp0public\ops\" >nul 2>&1

echo.
echo [3/3] Publishing to live web on Vercel...
vercel deploy --prod --yes --scope billow-and-breeze "%~dp0."

echo.
echo ========================================================
echo [SUCCESS] Live sites deployed!
echo Main Gazette:  https://pleasant-ridge-gazette.vercel.app
echo 449 Arcade:    https://pleasant-ridge-gazette.vercel.app/arcade
echo Breaker Vault: https://pleasant-ridge-gazette.vercel.app/breaker_vault
echo Ops Dashboard: https://pleasant-ridge-gazette.vercel.app/ops
echo ========================================================
ping 127.0.0.1 -n 4 >nul
