#!/bin/bash

echo "启动生物学实验助手 MCP 服务..."
echo

# 检查是否已安装Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "错误：未找到Python。请先安装Python。"
    exit 1
fi

# 使用python3或python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
else
    PYTHON_CMD="python"
    PIP_CMD="pip"
fi

# 检查是否已安装依赖
if ! $PIP_CMD show fastmcp &> /dev/null; then
    echo "正在安装依赖..."
    $PIP_CMD install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "错误：依赖安装失败。"
        exit 1
    fi
fi

echo "启动服务..."
$PYTHON_CMD biology-experiment-assistant.py 