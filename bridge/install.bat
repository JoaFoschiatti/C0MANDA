@echo off
echo === Comanda Printer Bridge - Instalacion ===
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado. Instala Node.js 18+ desde https://nodejs.org
    pause
    exit /b 1
)

echo Verificando version de Node.js...
node -e "if(parseInt(process.version.slice(1))<18){console.error('ERROR: Se requiere Node.js 18+');process.exit(1)}"
if %errorlevel% neq 0 (
    pause
    exit /b 1
)

echo.
echo Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Fallo la instalacion de dependencias
    pause
    exit /b 1
)

if not exist .env (
    echo.
    echo Creando archivo .env desde .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANTE: Edita el archivo .env con tu configuracion:
    echo   - BRIDGE_TOKEN: debe coincidir con el token del backend
    echo   - PRINTER_NAME: nombre exacto de la impresora en Windows
    echo.
) else (
    echo.
    echo Archivo .env ya existe, no se sobreescribe.
)

echo.
echo === Instalacion completa ===
echo.
echo Para iniciar el bridge:
echo   node index.js
echo.
pause
