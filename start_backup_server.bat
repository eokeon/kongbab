@echo off
chcp 65001 > nul
title 콩밥특별시 GTA RP 백업 동기화 서버 (D:\백업 파일\KONGBAB_BACKUPS_JSON)
echo ========================================================
echo   콩밥특별시 GTA RP 백업 동기화 서버 시작 중...
echo   대상 폴더: D:\백업 파일\KONGBAB_BACKUPS_JSON
echo ========================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup_server.ps1"
pause
