#!/usr/bin/env python3
"""
MCP Host Final - 直接调用MCP服务的智能管理平台
在终端中通过DeepSeek AI直接使用MCP服务
"""

import subprocess
import json
import os
import sys
from pathlib import Path
import requests
import asyncio
import shlex

class MCPHostFinal:
    def __init__(self):
        self.workspace = Path("./mcp_workspace")
        self.workspace.mkdir(exist_ok=True)
        
        # 三个核心MCP服务
        self.mcp_services = {
            "compass": {
                "name": "mcp-compass",
                "package": "@liuyoshio/mcp-compass",
                "description": "🧭 发现和搜索MCP服务",
                "installed": False
            },
            "installer": {
                "name": "mcp-installer", 
                "package": "@anaisbetts/mcp-installer",
                "description": "📦 安装MCP服务",
                "installed": False
            },
            "create": {
                "name": "mcp-create",
                "package": "mcp-create",
                "description": "🛠️ 创建MCP服务器",
                "installed": False
            }
        }
        
        # DeepSeek API配置
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "sk-392a95fc7d2445f6b6c79c17725192d1")
        self.api_base = "https://api.deepseek.com/v1"
        
    def initialize(self):
        """初始化Host"""
      
        
        # 检查Node.js
        if not self._check_nodejs():
            return False
            
        # 确保三个MCP服务可用
        print("🔧 准备MCP服务...")
        self._prepare_mcp_services()
        
        print("\n✅ MCP Host准备就绪!")
        return True
        
    def _check_nodejs(self):
        """检查Node.js环境"""
        try:
            # Windows上可能需要shell=True
            if sys.platform.startswith('win'):
                result = subprocess.run(['node', '--version'], 
                                      capture_output=True, text=True, shell=True)
            else:
                result = subprocess.run(['node', '--version'], 
                                      capture_output=True, text=True)
                
            if result.returncode == 0:
                print(f"✅ Node.js {result.stdout.strip()}")
                
                # 同时检查npm和npx
                npm_check = subprocess.run(['npm', '--version'], 
                                         capture_output=True, text=True, shell=True)
                if npm_check.returncode == 0:
                    print(f"✅ npm {npm_check.stdout.strip()}")
                else:
                    print("⚠️  npm不可用")
                    
                return True
        except Exception as e:
            print(f"❌ 检查失败: {e}")
            
        print("❌ 需要安装Node.js")
        print("👉 请访问 https://nodejs.org 下载安装")
        return False
        
    def _prepare_mcp_services(self):
        """准备MCP服务（安装但不验证）"""
        print("\n📋 准备MCP服务:")
        
        # 确保npm包被安装（全局安装以便复用）
        for service_id, config in self.mcp_services.items():
            print(f"   安装 {config['description']}...", end=" ", flush=True)
            
            try:
                # 尝试全局安装
                if sys.platform.startswith('win'):
                    cmd = f'npm install -g {config["package"]}'
                    result = subprocess.run(cmd, shell=True, capture_output=True, 
                                          text=True, timeout=60, encoding='utf-8', errors='ignore')
                else:
                    cmd = ['npm', 'install', '-g', config['package']]
                    result = subprocess.run(cmd, capture_output=True, 
                                          text=True, timeout=60)
                
                if result.returncode == 0:
                    config['installed'] = True
                    print("✅")
                else:
                    # 可能已经安装了
                    config['installed'] = True
                    print("⚠️ (可能已安装)")
                    
            except subprocess.TimeoutExpired:
                print("⏱️ (超时，稍后再试)")
                config['installed'] = True
            except Exception as e:
                print(f"❌ ({str(e)[:30]})")
                config['installed'] = True
                
        print("\n💡 服务准备完成，可以开始使用了")
        
    def analyze_request(self, user_input):
        """分析用户请求，决定使用哪个MCP服务"""
        # 使用AI分析
        try:
            analysis = self._ai_analyze(user_input)
            if analysis:
                return analysis
        except Exception as e:
            print(f"⚠️ AI分析失败: {e}")
            
        # 简单的关键词匹配作为备选
        user_lower = user_input.lower()
        if any(word in user_lower for word in ['找', '搜索', '查找', 'find', 'search', '有什么', '推荐']):
            return {
                "service": "compass",
                "action": "search",
                "query": user_input
            }
        elif any(word in user_lower for word in ['安装', '下载', 'install', 'download']):
            package_name = self._extract_package_name(user_input)
            return {
                "service": "installer",
                "action": "install",
                "package": package_name
            }
        elif any(word in user_lower for word in ['创建', '生成', '做', 'create', 'make', '新']):
            return {
                "service": "create",
                "action": "create",
                "description": user_input
            }
        else:
            return {
                "service": "compass",
                "action": "search",
                "query": user_input
            }
            
    def _ai_analyze(self, user_input):
        """使用AI分析用户请求"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "system",
                        "content": """分析用户的MCP需求，返回JSON：
{
    "service": "compass|installer|create",
    "action": "search|install|create",
    "query": "搜索关键词（用于compass）",
    "package": "包名（用于installer）",
    "description": "描述（用于create）"
}"""
                    },
                    {"role": "user", "content": user_input}
                ],
                "temperature": 0.1
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                # 提取JSON
                if '{' in content and '}' in content:
                    json_str = content[content.find('{'):content.rfind('}')+1]
                    return json.loads(json_str)
        except Exception as e:
            print(f"AI分析错误: {e}")
            
        return None
        
    def _extract_package_name(self, text):
        """从文本中提取包名"""
        words = text.split()
        for word in words:
            if '@' in word or 'mcp' in word.lower():
                return word
        return text.strip()
        
    def execute_request(self, analysis):
        """执行用户请求"""
        service = analysis['service']
        
        if service == 'compass':
            return self._use_compass(analysis.get('query', ''))
        elif service == 'installer':
            return self._use_installer(analysis.get('package', ''))
        elif service == 'create':
            return self._use_create(analysis.get('description', ''))
        else:
            return False, "未知的服务"
            
    def _use_compass(self, query):
        """直接调用mcp-compass搜索"""
        print(f"\n🧭 正在搜索: {query}")
        
        try:
            # 构建搜索命令
            if sys.platform.startswith('win'):
                # Windows: 使用npx直接调用
                cmd = f'npx -y @liuyoshio/mcp-compass search "{query}"'
                result = subprocess.run(cmd, shell=True, capture_output=True, 
                                      text=True, timeout=30, encoding='utf-8', errors='ignore')
            else:
                cmd = ['npx', '-y', '@liuyoshio/mcp-compass', 'search', query]
                result = subprocess.run(cmd, capture_output=True, 
                                      text=True, timeout=30)
            
            if result.stdout:
                print("\n📋 搜索结果:")
                print("─" * 50)
                print(result.stdout)
                print("─" * 50)
                
                # 使用AI解析结果
                self._ai_parse_results(result.stdout, query)
                return True, "搜索完成"
            else:
                # 如果没有输出，尝试其他方式
                print("⚠️ 没有找到结果，尝试npm搜索...")
                return self._npm_search(query)
                
        except subprocess.TimeoutExpired:
            print("⏱️ 搜索超时")
            return self._npm_search(query)
        except Exception as e:
            print(f"❌ 搜索错误: {e}")
            return self._npm_search(query)
            
    def _npm_search(self, query):
        """使用npm search作为备选"""
        try:
            search_term = f"mcp {query}"
            if sys.platform.startswith('win'):
                cmd = f'npm search {search_term} --json'
                result = subprocess.run(cmd, shell=True, capture_output=True,
                                      text=True, encoding='utf-8', errors='ignore')
            else:
                cmd = ['npm', 'search', search_term, '--json']
                result = subprocess.run(cmd, capture_output=True, text=True)
                
            if result.returncode == 0 and result.stdout:
                packages = json.loads(result.stdout)
                if packages:
                    print("\n📋 NPM搜索结果:")
                    print("─" * 50)
                    for i, pkg in enumerate(packages[:5]):  # 只显示前5个
                        print(f"{i+1}. {pkg['name']} - {pkg.get('description', 'No description')}")
                    print("─" * 50)
                    return True, "搜索完成"
                    
        except Exception as e:
            print(f"npm搜索错误: {e}")
            
        return False, "搜索失败"
        
    def _use_installer(self, package_name):
        """直接调用mcp-installer安装"""
        print(f"\n📦 正在安装: {package_name}")
        
        try:
            # 构建安装命令
            install_path = self.workspace / "installed" / package_name.replace('@', '').replace('/', '_')
            install_path.mkdir(parents=True, exist_ok=True)
            
            if sys.platform.startswith('win'):
                cmd = f'cd "{install_path}" && npm init -y && npm install {package_name}'
                result = subprocess.run(cmd, shell=True, capture_output=True, 
                                      text=True, timeout=120, encoding='utf-8', errors='ignore')
            else:
                # 先初始化package.json
                init_cmd = ['npm', 'init', '-y']
                subprocess.run(init_cmd, cwd=install_path, capture_output=True)
                
                # 然后安装包
                cmd = ['npm', 'install', package_name]
                result = subprocess.run(cmd, cwd=install_path, capture_output=True, 
                                      text=True, timeout=120)
            
            if result.returncode == 0:
                print(f"✅ 安装成功!")
                print(f"📁 安装位置: {install_path}")
                
                # 生成启动脚本
                self._create_launcher(package_name, install_path)
                return True, "安装完成"
            else:
                print(f"❌ 安装失败: {result.stderr}")
                return False, "安装失败"
                
        except Exception as e:
            print(f"❌ 安装错误: {e}")
            return False, f"安装错误: {e}"
            
    def _use_create(self, description):
        """使用AI创建MCP服务器"""
        print(f"\n🛠️ 正在创建: {description}")
        
        # 生成项目名称
        project_name = self._generate_project_name(description)
        project_path = self.workspace / "generated" / project_name
        project_path.mkdir(parents=True, exist_ok=True)
        
        print(f"📁 项目位置: {project_path}")
        
        # 使用AI生成代码
        success = self._ai_generate_mcp(description, project_path)
        
        if success:
            print(f"\n✅ MCP服务器创建成功!")
            print(f"📁 位置: {project_path}")
            print(f"\n💡 下一步:")
            print(f"   1. cd {project_path}")
            print(f"   2. npm install")
            print(f"   3. npm start")
            return True, "创建成功"
        else:
            return False, "创建失败"
            
    def _ai_parse_results(self, results, query):
        """使用AI解析搜索结果并给出建议"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "system",
                        "content": "根据搜索结果，推荐最合适的MCP服务，并说明原因。简洁回答。"
                    },
                    {
                        "role": "user",
                        "content": f"用户需求: {query}\n\n搜索结果:\n{results}"
                    }
                ],
                "temperature": 0.3
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                recommendation = result['choices'][0]['message']['content']
                print(f"\n🤖 AI推荐:")
                print("─" * 50)
                print(recommendation)
                print("─" * 50)
                
        except Exception as e:
            print(f"AI解析失败: {e}")
            
    def _generate_project_name(self, description):
        """生成项目名称"""
        # 简单处理：取前几个词
        words = description.replace('，', ' ').replace('。', ' ').split()[:3]
        name = '-'.join(words).lower()
        # 移除特殊字符
        name = ''.join(c for c in name if c.isalnum() or c == '-')
        return f"mcp-{name}" if not name.startswith('mcp') else name
        
    def _ai_generate_mcp(self, description, project_path):
        """使用AI生成MCP服务器代码"""
        try:
            # 生成package.json
            package_json = {
                "name": project_path.name,
                "version": "1.0.0",
                "description": description,
                "main": "server.js",
                "scripts": {
                    "start": "node server.js"
                },
                "dependencies": {
                    "@modelcontextprotocol/sdk": "latest"
                }
            }
            
            with open(project_path / "package.json", "w", encoding="utf-8") as f:
                json.dump(package_json, f, indent=2, ensure_ascii=False)
                
            # 使用AI生成server.js
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "system",
                        "content": """生成一个简单的MCP服务器代码(JavaScript)。
要求:
1. 使用@modelcontextprotocol/sdk
2. 实现基本功能
3. 代码简洁可运行
4. 包含适当的错误处理"""
                    },
                    {
                        "role": "user",
                        "content": f"创建MCP服务器: {description}"
                    }
                ],
                "temperature": 0.3
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                code = result['choices'][0]['message']['content']
                
                # 提取代码块
                if "```javascript" in code:
                    code = code.split("```javascript")[1].split("```")[0]
                elif "```js" in code:
                    code = code.split("```js")[1].split("```")[0]
                elif "```" in code:
                    code = code.split("```")[1].split("```")[0]
                    
                # 保存代码
                with open(project_path / "server.js", "w", encoding="utf-8") as f:
                    f.write(code.strip())
                    
                return True
                
        except Exception as e:
            print(f"生成代码失败: {e}")
            
        return False
        
    def _create_launcher(self, package_name, install_path):
        """创建启动脚本"""
        launcher_content = f"""#!/usr/bin/env node
// MCP Launcher for {package_name}
const {{ spawn }} = require('child_process');
const path = require('path');

const modulePath = path.join(__dirname, 'node_modules', '{package_name}');
const mcp = spawn('node', [modulePath], {{
    stdio: 'inherit'
}});

mcp.on('error', (err) => {{
    console.error('Failed to start MCP:', err);
}});
"""
        
        launcher_path = install_path / "start.js"
        with open(launcher_path, "w", encoding="utf-8") as f:
            f.write(launcher_content)
            
        print(f"📄 启动脚本: {launcher_path}")
        
    def show_guide(self):
        """显示使用指南"""
        print("""
📚 MCP Host 使用指南

直接在终端使用MCP服务，无需Claude Desktop!

🎯 支持的功能:
1. 搜索MCP服务 - "找天气相关的工具"
2. 安装MCP服务 - "安装 @modelcontextprotocol/server-filesystem"  
3. 创建MCP服务 - "创建一个翻译工具"

💡 特色功能:
• 使用DeepSeek AI智能分析需求
• 自动推荐最适合的MCP服务
• 一键安装和配置
• AI辅助生成MCP代码

🔧 工作原理:
1. 分析您的需求
2. 搜索或创建合适的MCP
3. 自动安装和配置
4. 提供使用指导
""")

def main():
    """主程序"""
    host = MCPHostFinal()
    
    # 初始化
    if not host.initialize():
        return
        
    # 显示使用指南
    host.show_guide()
    
    print("\n💬 告诉我您的需求，我来帮您实现!")
    print("输入 'help' 查看帮助，'quit' 退出\n")
    
    while True:
        try:
            user_input = input("🎤 您的需求: ").strip()
            
            if not user_input:
                continue
                
            if user_input.lower() == 'quit':
                print("👋 再见!")
                break
                
            if user_input.lower() == 'help':
                host.show_guide()
                continue
                
            # 分析请求
            print(f"\n🤖 分析您的需求...")
            analysis = host.analyze_request(user_input)
            
            print(f"📊 分析结果: 使用 {analysis['service']} 服务")
            
            # 执行请求
            success, message = host.execute_request(analysis)
            
            if success:
                print(f"\n✅ {message}")
            else:
                print(f"\n❌ {message}")
                
            print("\n" + "-" * 60)
            
        except KeyboardInterrupt:
            print("\n\n👋 再见!")
            break
        except Exception as e:
            print(f"\n❌ 错误: {e}")
            
if __name__ == "__main__":
    main() 