@echo off
REM ============================================================
REM  OrbisNet demo launcher — queues the whole stack in order:
REM    1. Docker Desktop     2. kind cluster (100-node network)
REM    3. backend host       4. desktop app
REM  Double-click and wait; four steps run in sequence.
REM ============================================================
title OrbisNet launcher
setlocal
set REPO=C:\Users\admin\OcuNet_SysApp
set KUBECONFIG=%USERPROFILE%\.kube\config-ocunet

echo.
echo [1/4] Starting Docker Desktop...
tasklist /FI "IMAGENAME eq com.docker.backend.exe" | find /I "com.docker" >nul
if errorlevel 1 start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo       waiting for the Docker engine (this can take a minute)...
:waitdocker
docker info >nul 2>&1
if errorlevel 1 (
  timeout /t 5 /nobreak >nul
  goto waitdocker
)
echo       Docker engine is up.

echo.
echo [2/4] Bringing up the kind cluster + 100-pod network...
cd /d "%REPO%"
"C:\Program Files\Git\bin\bash.exe" k8s-demo/run-demo.sh

echo.
echo       resetting to a quiet baseline (no attack carried over)...
"C:\Program Files\Git\bin\bash.exe" k8s-demo/attack.sh stop

echo.
echo [3/4] Starting the OrbisNet backend host...
start "OrbisNet backend" cmd /k "cd /d %REPO% && set KUBECONFIG=%KUBECONFIG% && node backend\server.js"
timeout /t 6 /nobreak >nul

echo.
echo [4/4] Launching the OrbisNet desktop app...
start "OrbisNet app" cmd /k "cd /d %REPO%\desktop-app && set ELECTRON_RUN_AS_NODE=&& npx electron-vite preview"

echo.
echo ============================================================
echo  OrbisNet is starting. The app window opens shortly.
echo  Generate traffic in a terminal with:
echo     bash k8s-demo/attack.sh known   (or: unknown / stop)
echo  Leave the two spawned windows open during the demo.
echo ============================================================
timeout /t 8 /nobreak >nul
endlocal
