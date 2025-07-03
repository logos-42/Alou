import { parseUserNeed, generateMCPCode } from './llm-native.js';
import { 
  searchMCPServers, 
  installMCPServer, 
  createMCPServer, 
  installDependencies,
  startMCPServer 
} from './mcp-tools.js';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

// 为 pkg 添加类型声明
declare global {
  namespace NodeJS {
    interface Process {
      pkg?: any;
    }
  }
}

// 处理 pkg 打包后的路径问题
const isPkg = typeof process.pkg !== 'undefined';
const execDir = isPkg ? path.dirname(process.execPath) : process.cwd();

// 加载环境变量
// 在打包环境中，尝试从执行文件所在目录加载 .env
if (isPkg) {
  dotenv.config({ path: path.join(execDir, '.env') });
} else {
dotenv.config();
}

// 获取 mcp-services 目录路径
function getMcpServicesDir(): string {
  return path.join(execDir, 'mcp-services');
}

// 生成配置说明
function generateConfigInstruction(serverName: string): string {
  const configPath = process.platform === 'win32' 
    ? 'C:\\Users\\%USERNAME%\\.cursor\\mcp.json'
    : '~/.cursor/mcp.json';
    
  return `
🔧 要在 Cursor 中使用此服务，请将以下配置添加到 ${configPath}:

查看生成的配置文件: ${path.join(getMcpServicesDir(), serverName.split('/').pop() || serverName, 'mcp-config.json')}
然后将其内容合并到你的主 mcp.json 文件的 "mcpServers" 部分。
`;
}

// 核心处理函数：处理用户需求
export async function handleUserNeed(userInput: string): Promise<string> {
  try {
    console.log('👤 用户需求:', userInput);
    
    // 1. 解析用户需求
    const need = await parseUserNeed(userInput);
    console.log('🧠 解析结果:', need);
    
    // 如果用户明确要求创建新服务，直接跳到创建步骤
    if (need.action === 'create') {
      console.log('🛠️ 用户要求创建新服务，跳过搜索步骤...');
      
      // 生成服务代码
      const code = await generateMCPCode(need.service_type, need.keywords);
      
      // 生成服务名称
      const serverName = `mcp-${need.service_type}-${Date.now()}`;
      
      // 创建服务
      const createResult = await createMCPServer('typescript', code, serverName, need.service_type);
      
      // 安装依赖
      const serverDir = path.dirname(createResult.configPath);
      await installDependencies(serverDir);
      
      const configInstruction = generateConfigInstruction(createResult.serverId);
      
      // 检查是否使用了备用方案
      if (!createResult.success && createResult.code) {
        return `⚠️ MCP Create 服务不可用，已使用备用方案创建服务

✅ 已成功创建新的 MCP 服务: ${createResult.serverId}
📁 服务目录: ${serverDir}
📄 配置文件: ${createResult.configPath}
📝 描述: ${need.description}

💡 创建的服务代码:
\`\`\`typescript
${createResult.code}
\`\`\`

${configInstruction}`;
      }
      
      return `✅ 已成功创建新的 MCP 服务: ${createResult.serverId}
📁 服务目录: ${serverDir}
📄 配置文件: ${createResult.configPath}
📝 描述: ${need.description}

${configInstruction}`;
    }
    
    // 2. 搜索现有服务
    const searchQuery = `${need.service_type} ${need.keywords.join(' ')}`;
    const searchResults = await searchMCPServers(searchQuery);
    
    // 3. 判断是否有合适的现有服务（降低阈值到 0.3，允许更多选择）
    const suitableServer = searchResults.find(server => server.similarity_score >= 0.3);
    
    if (suitableServer) {
      // 使用现有服务
      console.log('⭐ 找到合适的现有服务:', suitableServer.title);
      
      // 判断是否是 npm 包格式
      const isNpmPackage = suitableServer.title.startsWith('@') || 
                          suitableServer.title.includes('/') ||
                          suitableServer.title.match(/^[a-z0-9-]+$/);
      
      if (isNpmPackage) {
        try {
          await installMCPServer(suitableServer.title);
          const configInstruction = generateConfigInstruction(suitableServer.title);
          return `✅ 已成功安装 ${suitableServer.title} 服务
📝 描述: ${suitableServer.description}
📄 配置文件已生成

${configInstruction}`;
        } catch (installError) {
          console.error('安装失败，尝试创建新服务:', installError);
          // 如果安装失败，继续创建新服务
        }
      } else if (suitableServer.github_url) {
        // GitHub 项目，尝试用 MCP Installer 安装
        const serverName = suitableServer.title.toLowerCase().replace(/\s+/g, '-');
        
        console.log(`📦 找到 GitHub 项目，尝试使用 MCP Installer 安装...`);
        
        // 尝试多种可能的包名格式
        const possibleNames = [
          serverName,  // mcp-server-tavily
          suitableServer.title.toLowerCase(),  // 原始标题小写
          suitableServer.github_url.split('/').pop() || serverName,  // 仓库名
        ];
        
        // 如果 GitHub URL 包含用户名，尝试 @username/package 格式
        const githubMatch = suitableServer.github_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (githubMatch) {
          const [, username, repo] = githubMatch;
          possibleNames.push(`@${username.toLowerCase()}/${repo.toLowerCase()}`);
        }
        
        // 尝试每个可能的包名
        for (const packageName of possibleNames) {
          console.log(`🔍 尝试安装: ${packageName}`);
          try {
            await installMCPServer(packageName);
            const configInstruction = generateConfigInstruction(packageName);
            return `✅ 已成功安装 ${packageName} 服务
📝 描述: ${suitableServer.description}
📄 配置文件已生成
🔗 GitHub: ${suitableServer.github_url}

${configInstruction}`;
          } catch (installError) {
            console.log(`⚠️ ${packageName} 安装失败，尝试下一个...`);
          }
        }
        
        // 如果所有尝试都失败了，提供手动安装说明
        const serverDir = path.join(process.cwd(), 'mcp-services', serverName);
        return `⚠️ 无法通过 MCP Installer 自动安装该服务

📦 服务信息:
- 名称: ${suitableServer.title}
- 描述: ${suitableServer.description}
- GitHub: ${suitableServer.github_url}

💡 手动安装步骤:
1. git clone ${suitableServer.github_url} ${serverDir}
2. cd ${serverDir}
3. npm install
4. 创建 MCP 配置文件指向该目录

或者你可以重新运行命令创建一个新的服务。`;
      }
    }
    
    // 4. 创建新服务
    console.log('🔨 未找到合适的现有服务，开始创建新服务...');
    
    // 生成服务代码
    const code = await generateMCPCode(need.service_type, need.keywords);
    
    // 生成服务名称
    const serverName = `mcp-${need.service_type}-${Date.now()}`;
    
    // 创建服务
    const createResult = await createMCPServer('typescript', code, serverName, need.service_type);
    
    // 安装依赖
    const serverDir = path.dirname(createResult.configPath);
    await installDependencies(serverDir);
    
    const configInstruction = generateConfigInstruction(createResult.serverId);
    
    // 检查是否使用了备用方案
    if (!createResult.success && createResult.code) {
      return `⚠️ MCP Create 服务不可用，已使用备用方案创建服务

✅ 已成功创建新的 MCP 服务: ${createResult.serverId}
📁 服务目录: ${serverDir}
📄 配置文件: ${createResult.configPath}

💡 创建的服务代码:
\`\`\`typescript
${createResult.code}
\`\`\`

${configInstruction}`;
    }
    
    return `✅ 已成功创建新的 MCP 服务: ${createResult.serverId}
📁 服务目录: ${serverDir}
📄 配置文件: ${createResult.configPath}

${configInstruction}`;
    
  } catch (error) {
    console.error('❌ 处理失败:', error);
    return `处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
  }
}

// Web API 接口（可选）
export async function startWebServer(port: number = 3000) {
  const express = require('express');
  const cors = require('cors');
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  
  // API 端点：处理用户需求
  app.post('/api/handle-need', async (req: any, res: any) => {
    const { userInput } = req.body;
    
    if (!userInput) {
      return res.status(400).json({ error: '请提供用户输入' });
    }
    
    try {
      const result = await handleUserNeed(userInput);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : '处理失败' 
      });
    }
  });
  
  // 健康检查
  app.get('/health', (req: any, res: any) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });
  
  app.listen(port, () => {
    console.log(`🌐 MCP Host 服务已启动: http://localhost:${port}`);
    console.log(`📍 API 端点: POST http://localhost:${port}/api/handle-need`);
  });
}

// 等待用户按键的辅助函数
async function waitForKeyPress(message: string = '按回车键退出...') {
  if (!isPkg) return; // 非打包环境不需要等待
  
  console.log(`\n${message}`);
  
  // 创建一个简单的等待输入的 Promise
  return new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // 监听任何输入行
    rl.on('line', () => {
      rl.close();
      resolve();
    });
    
    // 监听关闭事件
    rl.on('close', () => {
      resolve();
    });
  });
}

// 交互式命令行界面
async function runInteractive() {
  console.log(`
🤖 MCP Host - 智能 MCP 服务管理器

输入你的需求，例如:
  - "我需要一个天气查询服务"
  - "帮我创建一个翻译服务"
  - "安装股票查询服务"
  
输入 'exit' 或 'quit' 退出程序
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n💬 请输入你的需求: '
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('\n👋 再见！');
      rl.close();
      return;
    }
    
    if (input) {
      try {
        console.log('\n⏳ 正在处理...\n');
        const result = await handleUserNeed(input);
        console.log('\n' + result);
      } catch (error) {
        console.error('\n❌ 处理失败:', error);
      }
    }
    
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

// CLI 接口
async function runCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 无参数时进入交互模式
    await runInteractive();
    return;
  }
  
  if (args[0] === '--server') {
    const port = args[1] ? parseInt(args[1]) : 3000;
    await startWebServer(port);
  } else {
    const userInput = args.join(' ');
    const result = await handleUserNeed(userInput);
    console.log('\n' + result);
    
    // 打包环境下执行完任务后，等待用户按键再退出
    await waitForKeyPress();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runCLI().catch(console.error);
} 

// 导出 main 函数供 pkg 使用
export const main = runCLI; 