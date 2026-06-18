@echo off
title ParrotPrinter - Inicializador Windows
echo ==========================================================
echo               PARROT PRINTER - INICIALIZADOR LOCAL
echo ==========================================================
echo.
echo Este script ira iniciar o monitor das suas impressoras 3D localmente.
echo Isso resolve o erro "The operation is insecure" (Mixed Content do HTTPS)
echo e permite que o aplicativo conecte em IPs locais da sua rede.
echo.

:: Tentativa simples de rodar instalador de dependencias se nao existirem
if not exist node_modules (
    echo [1/2] Pasta node_modules nao encontrada. Instalando dependencias locais, por favor aguarde...
    echo.
    call npm install
) else (
    echo [1/2] Dependencias ja identificadas na pasta local.
)

echo.
echo [2/2] Iniciando o servidor local em modo desenvolvimento (npm run dev)...
echo.
echo ==========================================================
echo SUCESSO! O painel iniciara localmente.
echo Acesse o link abaixo no seu navegador se nao abrir automaticamente:
echo ===^> http://localhost:3000
echo ==========================================================
echo.

:: Aguarda 2 segundos e abre o navegador
timeout /t 2 /nobreak >nul 2>&1
start http://localhost:3000

:: Inicia o servidor local
call npm run dev

pause
