#!/usr/bin/env bash
# Run after the reboot that enabled Virtual Machine Platform.
set -e
S="C:/Users/admin/AppData/Local/Temp/claude/c--Users-admin-OcuNet-SysApp/65f88c80-4d20-473b-b01f-22b8756d490c/scratchpad"
cd /c/Users/admin/OcuNet_SysApp

echo "== 1. hypervisor =="
powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).HypervisorPresent"

echo "== 2. import Ubuntu (rootfs already downloaded, 340MB) =="
mkdir -p /c/Users/admin/WSL/Ubuntu
wsl.exe --import Ubuntu 'C:\Users\admin\WSL\Ubuntu' "$S/ubuntu.tar.gz" --version 2 2>&1 | tr -d '\0'
wsl.exe -l -v 2>&1 | tr -d '\0'

echo "== 3. docker daemon =="
"/c/Program Files/Docker/Docker/Docker Desktop.exe" > /dev/null 2>&1 &
for i in $(seq 1 20); do docker info > /dev/null 2>&1 && { echo "daemon up"; break; }; sleep 15; done
docker version --format 'server {{.Server.Os}} engine {{.Server.Version}}'

echo "== 4. backend container =="
docker compose up -d --build
docker compose ps
curl -s -m 10 http://127.0.0.1:8787/health | head -c 300; echo
