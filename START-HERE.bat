@echo off
cd /d "%~dp0"
title Study Hub
echo ============================================================
echo   Study Hub - Course Study Sites
echo   Starting a local server so videos and glossaries work.
echo   A browser tab will open at http://localhost:8000
echo   To STOP the site: just close this window.
echo ============================================================
echo.
start "" http://localhost:8000/index.html
python -m http.server 8000 2>nul || py -m http.server 8000
