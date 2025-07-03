MCP Host - 智能 MCP 服务管理器
=====================================

版本: 1.0.0 (完整版)
构建时间: 2025/7/2 20:21:02

功能特性
--------
✅ 智能解析用户需求（基于 LLM）
✅ 搜索现有 MCP 服务（MCP Compass）
✅ 安装 MCP 服务（MCP Installer）
✅ 创建新 MCP 服务（MCP Create）
✅ Web API 服务器模式

快速开始
--------
1. 编辑 .env 文件（可选，已包含默认 API 密钥）
2. 运行命令：
   mcp-host.exe

使用示例
--------
# 搜索服务
mcp-host.exe "搜索天气查询服务"
mcp-host.exe "我需要一个翻译工具"

# 创建服务
mcp-host.exe "创建一个股票查询服务"
mcp-host.exe "帮我开发一个数据库管理工具"

# 安装服务
mcp-host.exe "安装 @modelcontextprotocol/server-brave-search"

# 启动 Web 服务器
mcp-host.exe --server 3000

常见问题
--------
Q: Windows 安全警告？
A: 右键点击 exe → 属性 → 勾选"解除锁定" → 确定

Q: 提示找不到模块？
A: 确保 .env 文件与 mcp-host.exe 在同一目录

Q: API 调用失败？
A: 检查网络连接，确认 API 密钥有效

Q: 如何使用创建的服务？
A: 将生成的 mcp-config.json 内容添加到 Cursor 的配置文件中

技术支持
--------
遇到问题请提供以下信息：
- 错误截图或完整错误信息
- 使用的命令
- Windows 版本

许可证
------
MIT License

作者：MCP Host 开发团队
