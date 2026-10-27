@echo off
title Thoorigai Ledger - Server Launcher
echo ========================================================
echo   Starting Thoorigai Ledger Servers...
echo ========================================================
echo.

echo [1/2] Starting API Backend on Port 3001...
start "Thoorigai API (Port 3001)" cmd /k "cd /d \"%~dp0api\" && node --env-file=.env dist/main.js"

echo [2/2] Starting Web Application on Port 3000...
start "Thoorigai Web (Port 3000)" cmd /k "cd /d \"%~dp0web\" && npm run dev"

echo.
echo ========================================================
echo   Servers are running! Keep the two windows open.
echo   - Web Portal: http://localhost:3000
echo   - Mobile / LAN: http://192.168.1.12:3000
echo   - API Health: http://localhost:3001/health
echo ========================================================
pause

