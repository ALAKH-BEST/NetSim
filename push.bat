@echo off
title NetSim - Push to GitHub
echo ========================================================
echo  NetSim - Pushing main branch to:
echo  https://github.com/ALAKH-BEST/NetSim.git
echo  Author: ALAKH-BEST (alakhraj.com@gmail.com)
echo ========================================================
echo.
..\PortableGit\cmd\git.exe push -u origin main
echo.
pause
