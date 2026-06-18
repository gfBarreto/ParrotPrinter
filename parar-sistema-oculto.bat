@echo off
title ParrotPrinter - Parar Sistema Oculto
echo ==========================================================
echo         PARROT PRINTER - PARAR SERVIDOR EM SEGUNDO PLANO
echo ==========================================================
echo.
echo Procurando e parando processos do Node.js de background...
echo.

:: Kill node processes that run on port 3000
taskkill /f /im node.exe >nul 2>&1

echo.
echo ==========================================================
echo SUCESSO! O servidor em segundo plano foi finalizado!
echo Os alertas de som de segundo plano foram desativados.
echo ==========================================================
echo.
pause
