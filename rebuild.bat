@echo off
echo 正在重新编译项目...
call npm run compile
if %errorlevel% neq 0 (
    echo 编译失败！
    pause
    exit /b 1
)

echo 正在打包为可执行文件...
call npx pkg dist/index.js --targets node18-win-x64 --output mcp-host-new.exe
if %errorlevel% neq 0 (
    echo 打包失败！
    pause
    exit /b 1
)

echo 重新打包完成！
echo 新的可执行文件：mcp-host-new.exe
pause 