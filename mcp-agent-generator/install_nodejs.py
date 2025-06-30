#!/usr/bin/env python3
"""
Node.js安装指导脚本
帮助用户安装Node.js环境以支持MCP完整功能
"""

import os
import platform
import subprocess
import sys
import webbrowser

def check_nodejs():
    """检查Node.js是否已安装"""
    try:
        node_result = subprocess.run(['node', '--version'], 
                                    capture_output=True, 
                                    text=True)
        
        if node_result.returncode == 0:
            version = node_result.stdout.strip()
            print(f"✅ Node.js已安装: {version}")
            return True
        
    except FileNotFoundError:
        pass
    
    print("❌ Node.js未安装或无法访问")
    return False

def check_npm():
    """检查npm是否已安装"""
    try:
        npm_result = subprocess.run(['npm', '--version'], 
                                   capture_output=True, 
                                   text=True)
        
        if npm_result.returncode == 0:
            version = npm_result.stdout.strip()
            print(f"✅ npm已安装: {version}")
            return True
        
    except FileNotFoundError:
        pass
    
    print("❌ npm未安装或无法访问")
    return False

def open_download_page():
    """打开Node.js下载页面"""
    download_url = "https://nodejs.org/en/download/"
    
    print(f"\n正在打开Node.js官方下载页面: {download_url}")
    webbrowser.open(download_url)

def show_installation_guide():
    """显示安装指南"""
    system = platform.system()
    
    print("\n" + "="*60)
    print("📚 Node.js安装指南")
    print("="*60)
    
    if system == "Windows":
        print("Windows安装方式：")
        print("1. 下载并运行Node.js安装程序(.msi)文件")
        print("2. 按照安装向导进行安装，保持默认选项即可")
        print("3. 安装完成后，重启命令提示符或PowerShell")
    
    elif system == "Darwin":  # macOS
        print("macOS安装方式：")
        print("1. 使用Homebrew(推荐):")
        print("   brew install node")
        print("\n2. 或者下载并运行Node.js安装包(.pkg)")
    
    elif system == "Linux":
        print("Linux安装方式：")
        print("1. 使用包管理器(Ubuntu/Debian):")
        print("   sudo apt update")
        print("   sudo apt install nodejs npm")
        print("\n2. 使用包管理器(CentOS/RHEL):")
        print("   sudo yum install nodejs")
    
    print("\n安装完成后验证:")
    print("node --version")
    print("npm --version")
    
    print("\n" + "="*60)
    print("安装完成后，请重新运行setup_and_run.py以启动MCP管理平台")
    print("="*60)

def main():
    """主函数"""
    print("🔍 检查Node.js环境...")
    
    has_node = check_nodejs()
    has_npm = check_npm()
    
    if has_node and has_npm:
        print("\n✅ 已检测到Node.js和npm，MCP管理平台可以完全正常工作！")
        return
    
    print("\n⚠️ 需要安装Node.js和npm才能使用MCP管理平台的完整功能")
    
    choice = input("\n是否打开Node.js官方下载页面？(y/n): ")
    if choice.lower() in ["y", "yes", "是"]:
        open_download_page()
    
    show_installation_guide()

if __name__ == "__main__":
    main() 