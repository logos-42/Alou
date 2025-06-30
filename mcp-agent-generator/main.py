#!/usr/bin/env python3
"""
MCP智能体生成器 - 核心功能
1. 分析需求 → 2. 搜索MCP → 3. 安装或生成 → 4. 部署
"""

import os
import json
import uuid
import asyncio
import subprocess
import platform
from pathlib import Path
from typing import Dict, Any, Optional, List
import openai

# 导入MCP工具集成模块
try:
    from mcp_tools_integration import simple_mcp_search, simple_mcp_install
except ImportError:
    simple_mcp_search = None
    simple_mcp_install = None

# 配置
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-392a95fc7d2445f6b6c79c17725192d1")
SERVERS_DIR = Path("generated_servers")
SERVERS_DIR.mkdir(exist_ok=True)

# DeepSeek客户端
client = openai.OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com/v1"
)

# 预定义的MCP服务器列表（作为搜索功能的补充）
KNOWN_MCP_SERVERS = [
    {
        "name": "@modelcontextprotocol/server-filesystem",
        "package": "@modelcontextprotocol/server-filesystem",
        "description": "File system operations - read, write, manage files",
        "keywords": ["file", "filesystem", "fs", "read", "write", "文件", "目录", "搜索文件", "文件夹", "管理"]
    },
    {
        "name": "@modelcontextprotocol/server-github",
        "package": "@modelcontextprotocol/server-github",
        "description": "GitHub integration - repos, issues, PRs",
        "keywords": ["github", "git", "repo", "repository", "代码", "仓库"]
    },
    {
        "name": "mcp-server-fetch",
        "package": "mcp-server-fetch",
        "description": "HTTP/HTTPS fetch operations",
        "keywords": ["fetch", "http", "api", "web", "request", "网页", "请求"]
    },
    {
        "name": "@modelcontextprotocol/server-postgres",
        "package": "@modelcontextprotocol/server-postgres",
        "description": "PostgreSQL database operations",
        "keywords": ["postgres", "postgresql", "database", "sql", "数据库"]
    },
    {
        "name": "mcp-server-sqlite",
        "package": "mcp-server-sqlite",
        "description": "SQLite database operations",
        "keywords": ["sqlite", "database", "sql", "db", "本地数据库"]
    },
    {
        "name": "mcp-server-time",
        "package": "mcp-server-time",
        "description": "Time and date operations",
        "keywords": ["time", "date", "clock", "timer", "时间", "日期"]
    },
    {
        "name": "mcp-server-weather",
        "package": "mcp-server-weather",
        "description": "Weather information",
        "keywords": ["weather", "天气", "气温", "天气预报", "weather forecast"]
    },
    {
        "name": "mcp-server-notes",
        "package": "mcp-server-notes",
        "description": "Note taking and management",
        "keywords": ["note", "notes", "memo", "笔记", "记事", "记录", "备忘录"]
    }
]

def log(msg: str):
    """简单日志"""
    print(f"[MCP] {msg}")

async def analyze_need(sentence: str) -> Dict[str, Any]:
    """1. 使用DeepSeek分析用户需求"""
    log(f"🎯 分析需求: {sentence}")
    
    prompt = f"""
    分析用户需求：{sentence}
    
    返回JSON：
    {{
        "name": "英文名称",
        "chinese_name": "中文名称",
        "keywords": ["搜索关键词（包含中英文）"],
        "description": "功能描述"
    }}
    """
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    result = json.loads(response.choices[0].message.content)
    log(f"   识别为: {result['chinese_name']}")
    return result

async def search_mcp_locally(keywords: List[str]) -> Optional[Dict[str, Any]]:
    """2. 本地搜索MCP服务器"""
    log(f"🔍 搜索MCP: {' '.join(keywords)}")
    
    # 将关键词转为小写用于匹配
    search_terms = [k.lower() for k in keywords]
    
    # 计算每个服务器的匹配分数
    best_match = None
    best_score = 0
    
    for server in KNOWN_MCP_SERVERS:
        score = 0
        
        # 检查服务器关键词
        server_keywords = [k.lower() for k in server['keywords']]
        
        # 计算匹配分数
        for term in search_terms:
            for keyword in server_keywords:
                if term in keyword or keyword in term:
                    score += 1
        
        # 检查描述中的匹配
        desc_lower = server['description'].lower()
        for term in search_terms:
            if term in desc_lower:
                score += 0.5
        
        if score > best_score:
            best_score = score
            best_match = server
    
    if best_match and best_score > 0:
        log(f"✅ 找到匹配: {best_match['name']} (分数: {best_score})")
        return best_match
    
    return None

async def call_mcp_compass(keywords: List[str]) -> Optional[Dict[str, Any]]:
    """通过MCP协议调用mcp-compass搜索"""
    # 创建JavaScript脚本来调用mcp-compass
    script_content = f"""
import {{ Client }} from '@modelcontextprotocol/sdk/client/index.js';
import {{ StdioClientTransport }} from '@modelcontextprotocol/sdk/transport/stdio.js';

async function search() {{
    const transport = new StdioClientTransport({{
        command: 'npx',
        args: ['-y', '@liuyoshio/mcp-compass']
    }});
    
    const client = new Client({{
        name: 'mcp-search-client',
        version: '1.0.0'
    }}, {{
        capabilities: {{}}
    }});
    
    try {{
        await client.connect(transport);
        
        // 调用搜索工具
        const result = await client.callTool({{
            name: 'search_packages',
            arguments: {{
                query: '{' '.join(keywords)}'
            }}
        }});
        
        console.log(JSON.stringify(result.content));
        await client.close();
    }} catch (error) {{
        console.error(JSON.stringify({{error: error.message}}));
        process.exit(1);
    }}
}}

search().catch(console.error);
"""
    
    try:
        # 保存脚本
        script_file = Path("temp_compass_search.mjs")
        script_file.write_text(script_content)
        
        # 执行脚本
        shell = platform.system() == "Windows"
        result = subprocess.run(
            ["node", str(script_file)],
            capture_output=True,
            text=True,
            shell=shell,
            timeout=30
        )
        
        # 清理
        script_file.unlink(missing_ok=True)
        
        if result.returncode == 0 and result.stdout:
            data = json.loads(result.stdout)
            if isinstance(data, list) and data:
                return data[0]
    except Exception as e:
        log(f"⚠️ MCP Compass调用失败: {e}")
    
    return None

async def search_mcp(keywords: List[str]) -> Optional[Dict[str, Any]]:
    """2. 搜索MCP服务器（使用集成的搜索功能）"""
    # 使用集成的搜索功能
    if simple_mcp_search:
        query = ' '.join(keywords)
        packages = simple_mcp_search(query)
        if packages:
            log(f"找到 {len(packages)} 个相关包")
            # 返回第一个匹配的包
            return {
                "name": packages[0],
                "package": packages[0],
                "description": f"MCP package for {query}"
            }
    
    # 回退到本地搜索
    log("使用本地搜索...")
    return await search_mcp_locally(keywords)

async def install_mcp(package_info: Dict[str, Any], target_dir: Path) -> bool:
    """3. 安装MCP服务器"""
    package = package_info.get('package', package_info.get('name'))
    log(f"📦 安装MCP: {package}")
    
    # 使用集成的安装功能
    if simple_mcp_install:
        result = simple_mcp_install(package, str(target_dir.parent))
        if result.get("success"):
            log("✅ 使用MCP工具安装成功")
            # 将文件移动到目标目录
            installed_path = Path(result["path"])
            if installed_path.exists() and installed_path != target_dir:
                import shutil
                shutil.move(str(installed_path), str(target_dir))
            return True
    
    # 回退到直接npm安装
    try:
        # 确保目录存在
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # 初始化package.json
        package_json = {
            "name": f"mcp-{uuid.uuid4().hex[:8]}",
            "version": "1.0.0",
            "type": "module",
            "dependencies": {}
        }
        (target_dir / "package.json").write_text(json.dumps(package_json, indent=2))
        
        # Windows需要shell=True
        shell = platform.system() == "Windows"
        
        # 直接使用npm安装
        cmd = ["npm", "install", package]
        result = subprocess.run(cmd, cwd=target_dir, capture_output=True, shell=shell)
        
        if result.returncode == 0:
            log("✅ 安装成功")
            return True
        else:
            log(f"❌ 安装失败: {result.stderr.decode()}")
            
    except Exception as e:
        log(f"❌ 安装失败: {e}")
    
    return False

async def generate_mcp(spec: Dict[str, Any]) -> str:
    """4. 使用AI生成MCP代码"""
    log("🤖 AI生成MCP代码...")
    
    prompt = f"""
    创建MCP服务器：
    名称：{spec['chinese_name']}
    功能：{spec['description']}
    
    要求：
    1. #!/usr/bin/env node
    2. 使用@modelcontextprotocol/sdk版本0.7.0+
    3. ES6模块，导入必须包含.js扩展名
    4. 实现具体功能，不要占位符
    5. 中文错误提示
    6. 使用新的MCP SDK API
    
    生成完整server.js代码。
    """
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=3000
    )
    
    code = response.choices[0].message.content
    
    # 提取代码
    if "```" in code:
        import re
        matches = re.findall(r"```(?:javascript|js)?\n(.*?)```", code, re.DOTALL)
        if matches:
            code = matches[0].strip()
    
    if not code.startswith("#!/usr/bin/env node"):
        code = "#!/usr/bin/env node\n" + code
    
    return code

async def deploy_mcp(agent_id: str, code: str, spec: Dict[str, Any]) -> Path:
    """5. 部署MCP服务器"""
    log("📁 部署MCP服务器...")
    
    server_dir = SERVERS_DIR / agent_id
    server_dir.mkdir(parents=True, exist_ok=True)
    
    # 保存代码
    (server_dir / "server.js").write_text(code, encoding='utf-8')
    
    # 创建package.json
    package_json = {
        "name": agent_id,
        "version": "1.0.0",
        "type": "module",
        "dependencies": {
            "@modelcontextprotocol/sdk": "^0.7.0"
        }
    }
    (server_dir / "package.json").write_text(json.dumps(package_json, indent=2))
    
    # 安装依赖
    log("📦 安装依赖...")
    shell = platform.system() == "Windows"
    subprocess.run(["npm", "install"], cwd=server_dir, capture_output=True, shell=shell)
    
    log(f"✅ 部署完成: {server_dir}")
    return server_dir

async def create_mcp_from_need(sentence: str):
    """主流程：从需求创建MCP"""
    print("\n" + "="*50)
    
    # 1. 分析需求
    spec = await analyze_need(sentence)
    
    # 2. 搜索现有MCP
    mcp_server = await search_mcp(spec['keywords'])
    
    agent_id = f"mcp_{uuid.uuid4().hex[:8]}"
    server_dir = SERVERS_DIR / agent_id
    
    if mcp_server:
        # 3a. 找到了，安装它
        success = await install_mcp(mcp_server, server_dir)
        if success:
            package = mcp_server.get('package', mcp_server.get('name'))
            # 创建启动脚本
            script = f"""#!/usr/bin/env node
import {{ spawn }} from 'child_process';

const server = spawn('npx', ['{package}'], {{
    stdio: 'inherit'
}});

server.on('error', (err) => {{
    console.error('启动失败:', err);
}});
"""
            (server_dir / "server.js").write_text(script)
            
            print(f"\n✅ 成功安装MCP: {package}")
            print(f"📁 位置: {server_dir}")
            print(f"📄 描述: {mcp_server.get('description', '')}")
            print(f"\n配置到Claude Desktop:")
            print(f"""{{
  "mcpServers": {{
    "{agent_id}": {{
      "command": "npx",
      "args": ["{package}"]
    }}
  }}
}}""")
            return
    
    # 3b. 没找到，生成新的
    log("未找到完全匹配的MCP，开始生成...")
    
    # 4. AI生成代码
    code = await generate_mcp(spec)
    
    # 5. 部署
    server_path = await deploy_mcp(agent_id, code, spec)
    
    print(f"\n✅ 成功生成MCP: {spec['chinese_name']}")
    print(f"📁 位置: {server_path}")
    print(f"\n配置到Claude Desktop:")
    print(f"""{{
  "mcpServers": {{
    "{agent_id}": {{
      "command": "node",
      "args": ["{server_path / 'server.js'}"]
    }}
  }}
}}""")

async def main():
    """命令行界面"""
    print("🚀 MCP智能体生成器 v2.0")
    print("输入你的需求，我来创建MCP服务器")
    print("支持: 文件管理、天气查询、笔记记录、数据库操作等")
    print("输入 'quit' 退出\n")
    
    while True:
        try:
            sentence = input("💬 你的需求: ").strip()
            
            if sentence.lower() in ['quit', 'exit', 'q']:
                print("👋 再见!")
                break
                
            if not sentence:
                continue
                
            await create_mcp_from_need(sentence)
            
        except KeyboardInterrupt:
            print("\n👋 再见!")
            break
        except Exception as e:
            print(f"❌ 错误: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 