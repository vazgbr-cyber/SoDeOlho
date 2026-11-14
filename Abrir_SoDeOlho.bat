@echo off
chcp 65001 >nul
title Só de Olho - Servidor Local (Aero Glass)
echo ====================================================================
echo   👁️ Iniciando o aplicativo "Só de Olho"...
echo   O navegador abrirá automaticamente em http://localhost:5173
echo   (Mantenha esta janela aberta enquanto estiver usando o site)
echo ====================================================================
echo.
cd /d "%~dp0"
start "" "http://localhost:5173"
call npm.cmd run dev
pause
