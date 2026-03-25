@echo off
echo ========================================
echo  ConstruPrice - Iniciando Servidores
echo ========================================
echo.
echo Limpando cache do Next.js...
if exist .next rmdir /s /q .next
echo Cache limpo!
echo.
echo Iniciando API (porta 4001) e Frontend (porta 3000)...
echo.
npm run dev:all
