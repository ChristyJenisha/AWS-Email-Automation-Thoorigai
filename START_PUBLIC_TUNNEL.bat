@echo off
title Thoorigai Cloudflare Public Remote Tunnel
echo =========================================================
echo  Thoorigai Ledger - Cloudflare Public Tunnel
echo  Forwarding local port 3000 to Cloudflare Edge Network...
echo =========================================================
echo Keep this window open while coworkers are testing!
echo.
.\cloudflared.exe tunnel --url http://localhost:3000
pause
