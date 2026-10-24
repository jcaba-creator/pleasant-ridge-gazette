@echo off
title "Refresh and Publish The Pleasant Ridge Gazette (Civic Edition)"
color 0A
cd /d "%~dp0"

echo ========================================================
echo   REFRESHING CIVIC PRICE FEEDS & DEPLOYING
echo   1. Military/Gov Mirror: https://jcaba-creator.github.io/pleasant-ridge-gazette/
echo   2. Civilian Mobile:    https://pleasant-ridge-gazette-public.vercel.app
echo ========================================================

echo.
echo [1/3] Scraping latest corridor fuel and grocery benchmarks...
python update_gas_feed.py
python update_groceries_feed.py

echo.
echo [2/3] Publishing to GitHub Pages...
rem Safely stage ONLY public price data
git add gas_prices.json gas_prices.js gas_prices.csv data/groceries.json data/groceries.js
git commit -m "Automated price refresh" >nul 2>&1
git push origin main >nul 2>&1

echo.
echo [3/3] Publishing to Vercel...
call vercel deploy --prod --yes --scope billow-and-breeze . >nul 2>&1

echo.
echo ========================================================
echo [SUCCESS] Civic Gazette published with zero private dependencies!
echo ========================================================
ping 127.0.0.1 -n 4 >nul
