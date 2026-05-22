@echo off
chcp 65001 >nul
echo ========================================
echo   Остановка ЛитЭра
echo ========================================
echo.

cd backend
echo Остановка Docker контейнеров...
docker-compose down

if %ERRORLEVEL% EQU 0 (
    echo ✅ Все контейнеры остановлены!
) else (
    echo ❌ Ошибка при остановке контейнеров
)

echo.
cd ..
pause
