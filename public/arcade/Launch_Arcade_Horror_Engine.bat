@echo off
title ARCADE HORROR CABINET LAUNCHER
color 0C

echo =======================================================================
echo     449 ARCADE HORROR CABINET: THE BREAKER VAULT
echo =======================================================================
echo.
echo  [1] Launch HTML5 Rich Escape Game (Recommended - Web Audio, Flashlight, Radar)
echo  [2] Launch Interactive Terminal / Serial Hardware Simulator (Python)
echo.
set /p opt="Select execution mode (1 or 2, default 1): "

if "%opt%"=="2" goto python_engine
goto web_engine

:web_engine
echo Launching HTML5 Breaker Vault...
start "" "%~dp0breaker_vault.html"
goto end

:python_engine
echo Launching Python Serial/Terminal Simulator...
python "%~dp0arcade_full_engine.py" %*
pause

:end
