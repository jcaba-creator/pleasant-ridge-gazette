@echo off
title Project K9-Volt : 16-Level Cyber-Corgi De-Mutation Platformer
color 0b
echo ======================================================================
echo PROJECT K9-VOLT : 16-LEVEL CYBER-CORGI DE-MUTATION PLATFORMER
echo ======================================================================
echo Launching game in your default browser...
if exist "%~dp0project-k9-volt.html" (
    start "" "%~dp0project-k9-volt.html"
) else if exist "%~dp0Project_K9_Volt.html" (
    start "" "%~dp0Project_K9_Volt.html"
) else (
    start "" "http://localhost:8000/project-k9-volt.html"
)
exit
