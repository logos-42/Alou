#!/usr/bin/env python3
"""
MCP Host Improved - 智能MCP管理平台
让不懂技术的人也能轻松使用MCP服务
"""

import subprocess
import json
import os
import sys
from pathlib import Path
import requests
import time
import re
from typing import Dict, List, Optional, Tuple

class MCPHostImproved:
    def __init__(self):
        self.workspace = Path("./mcp_workspace")
        self.workspace.mkdir(exist_ok=True)
        
        # DeepSeek API配置
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "sk-392a95fc7d2445f6b6c79c17725192d1")
        self.api_base = "https://api.deepseek.com/v1"
        
        # MCP工具调用命令模板
        self.mcp_tools = {
            "compass": {
                "search": 'npx -y @liuyoshio/mcp-compass search "{query}"'
            },
            "installer": {
                "install": 'npx -y @anaisbetts/mcp-installer install "{package}"'
            },
            "create": {
                "create": 'npx -y mcp-create create "{name}"'
            }
        }
        
    def initialize(self):
        """初始化Host"""
        print("""
╔══════════════════════════════════════════════════════════════╗
║             MCP Host Improved - 智能MCP管理平台                ║
║         让不懂技术的人也能轻松使用MCP服务                      ║
╚══════════════════════════════════════════════════════════════╝
        """)
        
        # 检查Node.js
        if not self._check_nodejs():
            return False
            
        print("\n✅ MCP Host 准备就绪!")
        return True
        
    def _check_nodejs(self):
        """检查Node.js环境"""
        try:
            result = subprocess.run(['node', '--version'], 
                                  capture_output=True, text=True, shell=True)
            if result.returncode == 0:
                print(f"✅ Node.js {result.stdout.strip()}")
                return True
        except:
            pass
            
        print("❌ 需要安装Node.js")
        print("👉 请访问 https://nodejs.org 下载安装")
        return False
        
    def understand_need(self, user_input: str) -> Dict:
        """深度理解用户需求"""
        print(f"\n🤖 理解您的需求...")
        
        try:
            # 使用AI深度分析需求
            analysis = self._ai_deep_analyze(user_input)
            if analysis:
                return analysis
        except Exception as e:
            print(f"⚠️ AI分析出错: {e}")
            
        # 备用方案：简单分析
        return self._simple_analyze(user_input)
        
    def _ai_deep_analyze(self, user_input: str) -> Dict:
        """使用AI深度分析用户需求"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            prompt = f"""分析用户需求，理解他们想要做什么，并返回详细的JSON分析结果。

用户需求: {user_input}

请分析：
1. 用户的真实意图是什么？
2. 需要什么类型的MCP服务？
3. 需要哪些依赖包？
4. 具体的功能需求是什么？

返回JSON格式：
{{
    "intent": "用户的真实意图",
    "action": "search|install|create", 
    "service_type": "weather|translation|database|api|custom等",
    "required_packages": ["需要的npm包列表"],
    "features": ["具体功能点"],
    "search_query": "搜索关键词",
    "package_name": "要安装的包名",
    "project_name": "建议的项目名称",
    "description": "详细描述"
}}"""

            data = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "你是MCP服务专家，帮助分析用户需求。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=data,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # 提取JSON
                if '{' in content and '}' in content:
                    json_str = content[content.find('{'):content.rfind('}')+1]
                    analysis = json.loads(json_str)
                    
                    print(f"✅ 理解到您需要: {analysis.get('intent', '未知需求')}")
                    return analysis
                    
        except Exception as e:
            print(f"深度分析错误: {e}")
            
        return None
        
    def _simple_analyze(self, user_input: str) -> Dict:
        """简单分析用户需求"""
        user_lower = user_input.lower()
        
        # 检测意图
        if any(word in user_lower for word in ['找', '搜索', '查找', '有什么']):
            action = "search"
        elif any(word in user_lower for word in ['安装', '下载']):
            action = "install"
        else:
            action = "create"
            
        # 检测服务类型
        service_type = "custom"
        required_packages = []
        
        if "天气" in user_lower or "weather" in user_lower:
            service_type = "weather"
            required_packages = ["axios", "weather-js"]
        elif "翻译" in user_lower or "translate" in user_lower:
            service_type = "translation"
            required_packages = ["@vitalets/google-translate-api"]
            
        return {
            "intent": user_input,
            "action": action,
            "service_type": service_type,
            "required_packages": required_packages,
            "search_query": user_input,
            "description": user_input
        }
        
    def execute_need(self, analysis: Dict) -> Tuple[bool, str]:
        """执行用户需求"""
        action = analysis.get("action", "search")
        
        if action == "search":
            return self.search_mcp(analysis)
        elif action == "install":
            return self.install_mcp(analysis)
        else:
            return self.create_mcp(analysis)
            
    def search_mcp(self, analysis: Dict) -> Tuple[bool, str]:
        """搜索MCP服务"""
        query = analysis.get("search_query", "")
        service_type = analysis.get("service_type", "")
        print(f"\n🔍 搜索MCP服务: {query}")
        
        # 优先使用本地知识库快速匹配
        local_match = self._check_local_knowledge(query, service_type)
        if local_match:
            print("\n📋 找到匹配的MCP服务类型:")
            print("─" * 50)
            print(f"服务类型: {local_match['type']}")
            print(f"建议包: {', '.join(local_match['packages'])}")
            print(f"描述: {local_match['description']}")
            print("─" * 50)
            
            # 询问是否直接安装或创建
            print("\n💡 找到相关服务，您想要:")
            print("1. 安装现有包")
            print("2. 创建定制服务")
            choice = input("请选择 (1/2，默认2): ").strip()
            
            if choice == "1":
                analysis["action"] = "install"
                analysis["package_name"] = local_match['packages'][0]
                return self.install_mcp(analysis)
            else:
                analysis["action"] = "create"
                analysis["required_packages"] = local_match.get('dependencies', [])
                return self.create_mcp(analysis)
        
        # 快速npm搜索（超时设置为5秒）
        print("\n📦 快速搜索相关包...")
        npm_found = False
        
        try:
            # 构建搜索词
            search_terms = []
            if "mcp" not in query.lower():
                search_terms.append(f"mcp {query}")
            search_terms.append(f"@modelcontextprotocol {query}")
            
            for term in search_terms[:1]:  # 只搜索一个最相关的
                print(f"🔍 搜索: {term}")
                cmd = f'npm search "{term}" --json | head -20'  # 限制结果数量
                
                # 使用更短的超时时间
                result = subprocess.run(cmd, shell=True, capture_output=True,
                                      text=True, encoding='utf-8', errors='ignore', timeout=5)
                                      
                if result.returncode == 0 and result.stdout:
                    try:
                        # 尝试解析JSON，处理可能的截断
                        json_str = result.stdout
                        if json_str.strip().endswith(']'):
                            packages = json.loads(json_str)
                        else:
                            # 尝试修复截断的JSON
                            json_str = json_str[:json_str.rfind('}')+1] + ']'
                            packages = json.loads(json_str)
                            
                        if packages:
                            mcp_packages = [p for p in packages[:5] 
                                          if 'mcp' in p.get('name', '').lower() 
                                          or 'modelcontextprotocol' in p.get('name', '').lower()]
                            
                            if mcp_packages:
                                print("\n📋 找到以下MCP包:")
                                print("─" * 50)
                                for i, pkg in enumerate(mcp_packages, 1):
                                    print(f"{i}. {pkg['name']}")
                                    desc = pkg.get('description', '无描述')
                                    if desc:
                                        print(f"   📝 {desc[:50]}...")
                                print("─" * 50)
                                npm_found = True
                                break
                    except:
                        pass
                        
        except subprocess.TimeoutExpired:
            print("⏱️ 搜索超时（5秒）")
        except Exception as e:
            print(f"⚠️ 搜索出错: {str(e)[:50]}")
        
        # 无论搜索是否成功，都提供创建选项
        if npm_found:
            print("\n💡 您想要:")
            print("1. 安装找到的包")
            print("2. 创建定制的MCP服务")
            choice = input("请选择 (1/2，默认2): ").strip()
            
            if choice == "1" and mcp_packages:
                print("\n请输入要安装的包序号:")
                pkg_choice = input("序号: ").strip()
                try:
                    idx = int(pkg_choice) - 1
                    if 0 <= idx < len(mcp_packages):
                        analysis["action"] = "install"
                        analysis["package_name"] = mcp_packages[idx]['name']
                        return self.install_mcp(analysis)
                except:
                    pass
        else:
            print("\n🚀 没有找到完全匹配的包，但我可以为您创建一个定制的MCP服务！")
            
        # 默认创建新服务
        analysis["action"] = "create"
        analysis["description"] = analysis.get("description") or f"创建{query}相关的MCP服务"
        return self.create_mcp(analysis)
        
    def _check_local_knowledge(self, query: str, service_type: str) -> Optional[Dict]:
        """检查本地知识库中是否有匹配的服务类型"""
        # 扩展知识库
        knowledge = {
            "weather": {
                "type": "天气服务",
                "packages": ["@modelcontextprotocol/server-weather", "weather-js"],
                "dependencies": ["axios", "weather-js"],
                "description": "提供天气查询、天气预报等功能"
            },
            "translate": {
                "type": "翻译服务", 
                "packages": ["@vitalets/google-translate-api"],
                "dependencies": ["@vitalets/google-translate-api", "axios"],
                "description": "提供多语言翻译功能"
            },
            "map": {
                "type": "地图服务",
                "packages": ["leaflet", "mapbox-gl"],
                "dependencies": ["axios", "leaflet"],
                "description": "提供地图显示、定位、路线规划等功能"
            },
            "subway": {
                "type": "地铁服务",
                "packages": ["subway-api"],
                "dependencies": ["axios", "cheerio"],
                "description": "提供地铁线路、站点、时刻表查询功能"
            },
            "database": {
                "type": "数据库服务",
                "packages": ["sqlite3", "knex"],
                "dependencies": ["sqlite3", "knex"],
                "description": "提供数据存储和查询功能"
            },
            "file": {
                "type": "文件服务",
                "packages": ["@modelcontextprotocol/server-filesystem"],
                "dependencies": ["fs-extra"],
                "description": "提供文件读写、目录操作等功能"
            }
        }
        
        # 关键词映射
        keyword_map = {
            "天气": "weather",
            "weather": "weather",
            "翻译": "translate",
            "translate": "translate",
            "translation": "translate",
            "地图": "map",
            "map": "map",
            "地铁": "subway",
            "subway": "subway",
            "metro": "subway",
            "数据库": "database",
            "database": "database",
            "db": "database",
            "文件": "file",
            "file": "file",
            "filesystem": "file"
        }
        
        # 查找匹配
        query_lower = query.lower()
        for keyword, service_key in keyword_map.items():
            if keyword in query_lower or service_type == service_key:
                return knowledge.get(service_key)
                
        return None
        
    def _npm_search_fallback(self, query: str, timeout: int = 15) -> Tuple[bool, str]:
        """npm搜索备用方案"""
        try:
            # 构建更智能的搜索词
            search_terms = []
            if "mcp" not in query.lower():
                search_terms.append(f"mcp {query}")
            search_terms.append(f"@modelcontextprotocol {query}")
            search_terms.append(query)
            
            all_results = []
            
            for term in search_terms:
                print(f"📦 搜索: {term}")
                cmd = f'npm search {term} --json'
                result = subprocess.run(cmd, shell=True, capture_output=True,
                                      text=True, encoding='utf-8', errors='ignore', timeout=timeout)
                                      
                if result.returncode == 0 and result.stdout:
                    try:
                        packages = json.loads(result.stdout)
                        # 过滤MCP相关包
                        mcp_packages = [p for p in packages 
                                      if 'mcp' in p['name'].lower() 
                                      or 'modelcontextprotocol' in p['name'].lower()]
                        all_results.extend(mcp_packages)
                    except:
                        pass
                        
            if all_results:
                # 去重
                unique_packages = {p['name']: p for p in all_results}
                packages = list(unique_packages.values())[:10]
                
                print("\n📋 找到以下MCP服务:")
                print("─" * 50)
                for i, pkg in enumerate(packages, 1):
                    print(f"{i}. {pkg['name']}")
                    desc = pkg.get('description', '无描述')
                    if desc:
                        print(f"   📝 {desc[:60]}...")
                print("─" * 50)
                
                # AI推荐
                self._ai_parse_and_recommend(json.dumps(packages, ensure_ascii=False), query)
                return True, "搜索完成"
                
        except Exception as e:
            print(f"搜索错误: {e}")
            
        return False, "未找到相关服务"
        
    def install_mcp(self, analysis: Dict) -> Tuple[bool, str]:
        """智能安装MCP服务"""
        package_name = analysis.get("package_name") or analysis.get("search_query", "")
        required_packages = analysis.get("required_packages", [])
        
        print(f"\n📦 安装MCP服务: {package_name}")
        
        # 创建安装目录
        install_name = re.sub(r'[^\w\-]', '_', package_name)
        install_path = self.workspace / "installed" / install_name
        install_path.mkdir(parents=True, exist_ok=True)
        
        install_success = False
        
        # 尝试使用不同方法安装，最多重试2次
        for attempt in range(2):
            try:
                if attempt > 0:
                    print(f"\n🔄 重试安装 (尝试 {attempt + 1}/2)...")
                    
                # 方法1：使用MCP installer工具
                if not install_success and attempt == 0:
                    print("🔧 使用MCP Installer...")
                    installer_cmd = f'cd "{install_path}" && npx -y @anaisbetts/mcp-installer install {package_name}'
                    result = subprocess.run(installer_cmd, shell=True, capture_output=True,
                                          text=True, encoding='utf-8', errors='ignore', timeout=30)
                    
                    if result.returncode == 0:
                        install_success = True
                        
                # 方法2：直接npm安装
                if not install_success:
                    print("📥 使用npm直接安装...")
                    
                    # 初始化项目
                    init_cmd = f'cd "{install_path}" && npm init -y'
                    subprocess.run(init_cmd, shell=True, capture_output=True, timeout=10)
                    
                    # 安装主包
                    install_cmd = f'cd "{install_path}" && npm install {package_name}'
                    result = subprocess.run(install_cmd, shell=True, capture_output=True,
                                          text=True, encoding='utf-8', errors='ignore', timeout=60)
                    
                    if result.returncode == 0 or "packages" in result.stdout:
                        install_success = True
                        break
                        
            except subprocess.TimeoutExpired:
                print(f"⏱️ 安装超时")
                if attempt == 1:  # 最后一次尝试
                    print("\n🔧 安装服务暂时不可用，建议创建新的MCP服务")
                    # 转向创建流程
                    analysis["action"] = "create"
                    return self.create_mcp(analysis)
            except Exception as e:
                print(f"❌ 安装错误: {e}")
                if attempt == 1:
                    break
                    
        if install_success:
            # 智能分析并安装依赖
            if required_packages or analysis.get("service_type"):
                print("\n🤖 智能分析依赖...")
                deps = self._analyze_dependencies(package_name, analysis)
                
                if deps:
                    print(f"📥 安装依赖: {', '.join(deps)}")
                    for dep in deps:
                        try:
                            dep_cmd = f'cd "{install_path}" && npm install {dep}'
                            subprocess.run(dep_cmd, shell=True, capture_output=True, timeout=30)
                        except:
                            print(f"⚠️ 依赖 {dep} 安装失败，跳过")
                            
            # 创建智能启动器和配置
            self._create_smart_config(package_name, install_path, analysis)
            
            print(f"\n✅ 安装完成!")
            print(f"📁 位置: {install_path}")
            
            # 显示如何使用
            self._show_usage_guide(package_name, install_path)
            
            return True, "安装成功"
        else:
            print(f"\n❌ 安装失败，建议创建新的MCP服务")
            return False, "安装失败"
            
    def create_mcp(self, analysis: Dict) -> Tuple[bool, str]:
        """创建智能MCP服务"""
        description = analysis.get("description", "")
        service_type = analysis.get("service_type", "custom")
        required_packages = analysis.get("required_packages", [])
        features = analysis.get("features", [])
        
        print(f"\n🛠️ 创建MCP服务: {description}")
        
        # 生成项目名称
        project_name = analysis.get("project_name") or self._generate_project_name(description)
        project_path = self.workspace / "created" / project_name
        project_path.mkdir(parents=True, exist_ok=True)
        
        print(f"📁 项目位置: {project_path}")
        
        try:
            # 使用mcp-create工具创建基础结构
            print("🏗️ 创建项目结构...")
            create_cmd = f'cd "{project_path.parent}" && npx -y mcp-create create {project_name}'
            subprocess.run(create_cmd, shell=True, capture_output=True, timeout=30)
            
            # 使用AI生成智能代码
            print("🤖 生成智能代码...")
            success = self._ai_generate_smart_mcp(
                project_path, 
                description, 
                service_type,
                required_packages,
                features
            )
            
            if success:
                # 自动安装依赖
                print("\n📥 自动安装依赖...")
                install_cmd = f'cd "{project_path}" && npm install'
                result = subprocess.run(install_cmd, shell=True, capture_output=True,
                                      text=True, encoding='utf-8', errors='ignore')
                
                if result.returncode == 0:
                    print("✅ 依赖安装成功")
                else:
                    print("⚠️ 部分依赖可能需要手动安装")
                    
                # 生成配置文件
                self._generate_mcp_config(project_path, project_name)
                
                print(f"\n✅ MCP服务创建成功!")
                print(f"📁 位置: {project_path}")
                
                # 显示使用方法
                self._show_created_usage(project_path, project_name)
                
                return True, "创建成功"
                
        except Exception as e:
            print(f"创建错误: {e}")
            
        return False, "创建失败"
        
    def _analyze_dependencies(self, package_name: str, analysis: Dict) -> List[str]:
        """智能分析所需依赖"""
        deps = []
        service_type = analysis.get("service_type", "")
        
        # 根据服务类型添加常见依赖
        if service_type == "weather":
            deps.extend(["axios", "weather-js", "node-weather-api"])
        elif service_type == "translation":
            deps.extend(["@vitalets/google-translate-api", "axios"])
        elif service_type == "database":
            deps.extend(["sqlite3", "knex"])
        elif service_type == "api":
            deps.extend(["axios", "node-fetch"])
            
        # 添加用户指定的依赖
        if analysis.get("required_packages"):
            deps.extend(analysis["required_packages"])
            
        # 去重
        return list(set(deps))
        
    def _ai_generate_smart_mcp(self, project_path: Path, description: str, 
                               service_type: str, packages: List[str], 
                               features: List[str]) -> bool:
        """使用AI生成智能MCP服务代码"""
        try:
            # 准备package.json
            package_json = {
                "name": project_path.name,
                "version": "1.0.0",
                "description": description,
                "main": "index.js",
                "type": "module",
                "scripts": {
                    "start": "node index.js",
                    "dev": "node --watch index.js"
                },
                "dependencies": {
                    "@modelcontextprotocol/sdk": "latest"
                }
            }
            
            # 添加所需依赖
            for pkg in packages:
                package_json["dependencies"][pkg] = "latest"
                
            # 保存package.json
            with open(project_path / "package.json", "w", encoding="utf-8") as f:
                json.dump(package_json, f, indent=2, ensure_ascii=False)
                
            # 生成主代码
            code = self._generate_mcp_code(description, service_type, packages, features)
            if code:
                with open(project_path / "index.js", "w", encoding="utf-8") as f:
                    f.write(code)
                    
            # 生成README
            self._generate_readme(project_path, description, features)
            
            # 生成.env示例
            self._generate_env_example(project_path, service_type)
            
            return True
            
        except Exception as e:
            print(f"生成代码失败: {e}")
            return False
            
    def _generate_mcp_code(self, description: str, service_type: str, 
                          packages: List[str], features: List[str]) -> Optional[str]:
        """生成MCP服务代码"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # 构建更详细的提示
            imports_hint = "\n".join([f"import {pkg.split('/')[-1].replace('-', '')} from '{pkg}';" 
                                    for pkg in packages if pkg])
            
            features_desc = "\n".join([f"- {f}" for f in features]) if features else ""
            
            prompt = f"""生成一个完整的MCP服务器代码（ES模块格式）。

需求描述: {description}
服务类型: {service_type}
需要的包: {packages}

功能要求:
{features_desc}

代码要求:
1. 使用ES模块格式 (import/export)
2. 使用 @modelcontextprotocol/sdk 的最新API
3. 实现具体的功能，不要只是示例
4. 包含完善的错误处理
5. 代码要能直接运行
6. 根据服务类型实现相应的工具

可用的包导入示例:
{imports_hint}

请生成完整的 index.js 代码。确保代码结构清晰，功能完整。"""

            data = {
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "system", 
                        "content": "你是MCP（Model Context Protocol）服务开发专家。生成的代码要实用、完整、可直接运行。"
                    },
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=data,
                timeout=60
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
                    parts = code.split("```")
                    for i, part in enumerate(parts):
                        if i % 2 == 1:  # 奇数索引是代码块
                            code = part
                            break
                            
                return code.strip()
                
        except Exception as e:
            print(f"代码生成错误: {e}")
            
        # 返回一个基础模板
        return self._get_fallback_template(service_type)
        
    def _get_fallback_template(self, service_type: str) -> str:
        """获取备用模板"""
        return """import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
    name: 'custom-mcp-server',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {}
    }
});

// 添加工具
server.setRequestHandler('tools/list', async () => {
    return {
        tools: [{
            name: 'hello',
            description: 'Say hello',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                }
            }
        }]
    };
});

server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name === 'hello') {
        const name = request.params.arguments.name || 'World';
        return {
            content: [{
                type: 'text',
                text: `Hello, ${name}!`
            }]
        };
    }
});

// 启动服务器
const transport = new StdioServerTransport();
await server.connect(transport);
console.log('MCP Server started');"""
        
    def _generate_readme(self, project_path: Path, description: str, features: List[str]):
        """生成README文件"""
        features_text = "\n".join([f"- {f}" for f in features]) if features else "- 基础MCP功能"
        
        readme_content = f"""# {project_path.name}

{description}

## 功能特性

{features_text}

## 安装

```bash
npm install
```

## 使用方法

### 1. 直接运行

```bash
npm start
```

### 2. 配置到MCP客户端

将以下配置添加到您的 `mcp.json` 中:

```json
{{
    "{project_path.name}": {{
        "command": "node",
        "args": ["{project_path.absolute()}/index.js"]
    }}
}}
```

## 环境变量

如果需要配置环境变量，请创建 `.env` 文件并设置相应的值。

## 开发

```bash
npm run dev
```

## 许可证

MIT
"""
        
        with open(project_path / "README.md", "w", encoding="utf-8") as f:
            f.write(readme_content)
            
    def _generate_env_example(self, project_path: Path, service_type: str):
        """生成环境变量示例文件"""
        env_content = "# 环境变量配置\n\n"
        
        if service_type == "weather":
            env_content += "# 天气API密钥\nWEATHER_API_KEY=your_api_key_here\n"
        elif service_type == "translation":
            env_content += "# 翻译API配置\nTRANSLATE_API_KEY=your_api_key_here\n"
        elif service_type == "database":
            env_content += "# 数据库配置\nDB_PATH=./data.db\n"
            
        env_content += "\n# MCP服务配置\nMCP_PORT=3000\nMCP_HOST=localhost\n"
        
        with open(project_path / ".env.example", "w", encoding="utf-8") as f:
            f.write(env_content)
            
    def _create_smart_config(self, package_name: str, install_path: Path, analysis: Dict):
        """创建智能配置文件"""
        # 创建启动脚本
        launcher_content = f"""#!/usr/bin/env node
// MCP Smart Launcher for {package_name}

import {{ spawn }} from 'child_process';
import {{ fileURLToPath }} from 'url';
import {{ dirname, join }} from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 启动MCP服务: {package_name}');

// 智能查找主入口
const possibleEntries = [
    join(__dirname, 'node_modules', '{package_name}', 'index.js'),
    join(__dirname, 'node_modules', '{package_name}', 'dist', 'index.js'),
    join(__dirname, 'node_modules', '.bin', '{package_name}'),
];

let mainEntry = null;
for (const entry of possibleEntries) {{
    if (fs.existsSync(entry)) {{
        mainEntry = entry;
        break;
    }}
}}

if (!mainEntry) {{
    // 尝试直接使用npx
    console.log('📦 使用npx启动...');
    const mcp = spawn('npx', ['{package_name}'], {{
        stdio: 'inherit',
        shell: true
    }});
    
    mcp.on('exit', (code) => {{
        process.exit(code);
    }});
}} else {{
    const mcp = spawn('node', [mainEntry], {{
        stdio: 'inherit'
    }});
    
    mcp.on('error', (err) => {{
        console.error('❌ 启动失败:', err);
    }});
}}
"""
        
        launcher_path = install_path / "start.js"
        with open(launcher_path, "w", encoding="utf-8") as f:
            f.write(launcher_content)
            
        # 创建配置文件
        config = {
            "name": package_name,
            "description": analysis.get("description", "MCP Service"),
            "command": "node",
            "args": [str(launcher_path.absolute())],
            "env": {}
        }
        
        config_path = install_path / "mcp-config.json"
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
            
    def _generate_mcp_config(self, project_path: Path, project_name: str):
        """生成MCP配置文件"""
        config = {
            "name": project_name,
            "command": "node",
            "args": [str((project_path / "index.js").absolute())]
        }
        
        config_path = project_path / "mcp-config.json"
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
            
    def _show_usage_guide(self, package_name: str, install_path: Path):
        """显示使用指南"""
        print("\n📖 使用方法:")
        print(f"1. 添加到 mcp.json:")
        print(f"""   "{package_name}": {{
       "command": "node",
       "args": ["{install_path}/start.js"]
   }}""")
        print(f"\n2. 或直接运行:")
        print(f"   cd {install_path}")
        print(f"   node start.js")
        
    def _show_created_usage(self, project_path: Path, project_name: str):
        """显示创建后的使用方法"""
        print("\n📖 使用方法:")
        print(f"1. 进入项目目录:")
        print(f"   cd {project_path}")
        print(f"\n2. 启动服务:")
        print(f"   npm start")
        print(f"\n3. 添加到MCP客户端:")
        print(f"""   "{project_name}": {{
       "command": "node",  
       "args": ["{project_path}/index.js"]
   }}""")
        
    def _ai_parse_and_recommend(self, results: str, query: str):
        """AI解析搜索结果并推荐"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            prompt = f"""根据搜索结果，为用户推荐最合适的MCP服务。

用户需求: {query}

搜索结果:
{results}

请：
1. 分析哪个服务最符合用户需求
2. 解释为什么推荐这个服务
3. 如果没有完全匹配的，建议是安装最接近的还是创建新的

简洁明了地回答。"""

            data = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "你是MCP服务推荐专家。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=data,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                recommendation = result['choices'][0]['message']['content']
                print(f"\n🤖 AI建议:")
                print("─" * 40)
                print(recommendation)
                print("─" * 40)
                
        except Exception as e:
            print(f"AI推荐失败: {e}")
            
    def _generate_project_name(self, description: str) -> str:
        """生成项目名称"""
        # 提取关键词
        words = re.findall(r'[\u4e00-\u9fa5]+|[a-zA-Z]+', description.lower())
        
        # 翻译中文关键词
        trans_words = []
        for word in words[:3]:  # 只取前3个词
            if re.match(r'[\u4e00-\u9fa5]+', word):
                # 简单的中文映射
                trans_map = {
                    '天气': 'weather',
                    '翻译': 'translate',
                    '数据': 'data',
                    '文件': 'file',
                    '图片': 'image',
                    '音乐': 'music',
                    '视频': 'video',
                    '工具': 'tool'
                }
                trans_words.append(trans_map.get(word, word))
            else:
                trans_words.append(word)
                
        name = '-'.join(trans_words)
        return f"mcp-{name}" if name and not name.startswith('mcp') else "mcp-custom"
        
    def show_welcome(self):
        """显示欢迎信息"""
        print("""
🎯 我能帮您做什么？

1️⃣ 找MCP服务：告诉我您的需求，我来帮您找
   例如："我需要查天气的工具"
   
2️⃣ 装MCP服务：找到合适的服务后自动安装配置
   例如："安装 @modelcontextprotocol/server-weather"
   
3️⃣ 做MCP服务：根据您的需求创建新服务
   例如："帮我做一个翻译工具"

💡 小贴士：
• 说得越详细，我理解得越准确
• 我会自动识别并安装所需的依赖
• 创建的服务可以直接在Cursor中使用

""")

def main():
    """主程序"""
    host = MCPHostImproved()
    
    # 初始化
    if not host.initialize():
        return
        
    # 显示欢迎信息
    host.show_welcome()
    
    print("💬 请告诉我您的需求（输入 'quit' 退出）\n")
    
    while True:
        try:
            user_input = input("🎤 您: ").strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['quit', 'exit', '退出']:
                print("\n👋 再见！有需要随时找我！")
                break
                
            # 理解需求
            analysis = host.understand_need(user_input)
            
            # 执行需求
            success, message = host.execute_need(analysis)
            
            if success:
                print(f"\n✅ {message}")
                print("\n💡 还需要什么帮助吗？")
            else:
                print(f"\n❌ {message}")
                print("🔧 我们可以换个方式试试")
                
            print("\n" + "─" * 60 + "\n")
            
        except KeyboardInterrupt:
            print("\n\n👋 再见！")
            break
        except Exception as e:
            print(f"\n❌ 出错了: {e}")
            print("🔧 让我们重新开始...")
            
if __name__ == "__main__":
    main()
