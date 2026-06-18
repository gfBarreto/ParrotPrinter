@echo off
title Klipper Audio Hub - Inicializador Windows
echo ==========================================================
echo           KLIPPER AUDIO HUB - INICIALIZADOR LOCAL
echo ==========================================================
echo.
echo Este script ira iniciar o monitor das suas impressoras 3D localmente.
echo Isso resolve o erro "The operation is insecure" (Mixed Content do HTTPS)
echo e permite que o aplicativo conecte em IPs locais (Ex: 172.16.1.x) da sua rede.
echo.
echo Requisitos: Node.js instalado (https://nodejs.org)
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] O Node.js nao foi encontrado no seu Windows!
    echo Por favor, faca o download e instale o Node.js (versao LTS recomendada)
    echo a partir de: https://nodejs.org
    echo Depois de instalar, abra este arquivo novamente.
    echo.
    pause
    exit /b
)

echo [1/3] Instalando dependencias locais do projeto (aguarde)...
call npm install

echo [2/3] Gerando build estatica de producao...
call npm run build

echo [3/3] Iniciando o servidor web local...
echo.
echo ==========================================================
echo SUCESSO! O painel esta rodando localmente.
echo Acesse o link abaixo no seu navegador:
echo ===^> http://localhost:3000
echo ==========================================================
echo.
start http://localhost:3000
call npm run start
pause
