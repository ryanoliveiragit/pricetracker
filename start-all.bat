@echo off
echo ========================================
echo  ConstruPrice - Iniciando Sistema Completo
echo ========================================
echo.
echo Iniciando Backend Python (porta 8000)...
start "ConstruPrice Backend" cmd /k "cd backend && call venv\Scripts\activate && python main.py"
timeout /t 3 /nobreak >nul
echo.
echo Iniciando Frontend Next.js (porta 3000)...
start "ConstruPrice Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo ========================================
echo  Servidores Iniciados!
echo ========================================
echo.
echo Backend API: http://localhost:8000
echo Frontend: http://localhost:3000
echo Documentacao API: http://localhost:8000/docs
echo.
echo Pressione qualquer tecla para fechar este terminal...
pause >nul
