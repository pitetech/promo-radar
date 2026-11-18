@echo off
rem Entry point for the Windows Task Scheduler. Runs from the project root and appends to data\run.log.
cd /d "%~dp0.."
if not exist data mkdir data
node src\cli.mjs run >> data\run.log 2>&1
