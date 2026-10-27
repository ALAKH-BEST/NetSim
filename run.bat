@echo off
title NetSim - Interactive Network Simulator
echo ========================================================
echo  NetSim - Interactive Network Simulator
echo  Starting local server on http://localhost:3000...
echo ========================================================
start "" http://localhost:3000
node server.js
pause
