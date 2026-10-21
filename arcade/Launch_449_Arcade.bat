@echo off
title The 449 Field Arcade — Educational & Platformer Gaming Commons
color 0B

echo ======================================================================
echo           THE 449 FIELD ARCADE : PLEASANT RIDGE COMMONS
echo ======================================================================
echo.
echo Launching the 449 Field Arcade Hub in your default browser...
echo.
echo Featuring:
echo   [Plate I]    Sparkle Unicorn Adventure
echo   [Plate II]   Rainbow Unicorn Rescue
echo   [Plate III]  PokeGuess: Dex Challenge
echo   [Plate IV]   Starfall Math Galaxy
echo   [Plate V]    Enchanted Phonics Safari
echo   [Plate VI]   Homestead Critter Match
echo   [Plate VII]  The Breaker Vault: Sector 4 (Horror Escape)
echo   [Plate VIII] Project K9-Volt: 16-Level Cyber-Corgi Platformer
echo.

if exist "%~dp0449-arcade\index.html" (
    start "" "%~dp0449-arcade\index.html"
) else if exist "%~dp0index.html" (
    start "" "%~dp0index.html"
) else if exist "%~dp0pleasant-ridge-gazette\arcade\index.html" (
    start "" "%~dp0pleasant-ridge-gazette\arcade\index.html"
) else (
    start "" "http://localhost:8000/index.html"
)
exit
