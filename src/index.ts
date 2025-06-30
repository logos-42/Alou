import { parseUserNeed, generateMCPCode } from './llm.js';
import { 
  searchMCPServers, 
  installMCPServer, 
  createMCPServer, 
  installDependencies,
  startMCPServer 
} from './mcp-tools.js';
import path from 'path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 核心处理函数：处理用户需求
export async function handleUserNeed(userInput: string): Promise<string> {
  try {
    console.log('👤 用户需求:', userInput);
    
    // 1. 解析用户需求
    const need = await parseUserNeed(userInput);
    console.log('🧠 解析结果:', need);
    
    // 2. 搜索现有服务
    const searchQuery = `${need.service_type} ${need.keywords.join(' ')}`;
    const searchResults = await searchMCPServers(searchQuery);
    
    // 3. 判断是否有合适的现有服务（相似度阈值 0.8）
    const suitableServer = searchResults.find(server => server.similarity_score >= 0.8);
    
    if (suitableServer) {
      // 使用现有服务
      console.log('⭐ 找到合适的现有服务:', suitableServer.title);
      
      try {
        await installMCPServer(suitableServer.title);
        return `✅ 已成功安装 ${suitableServer.title} 服务\n描述: ${suitableServer.description}\n配置文件已生成，可以直接在 Cursor 或 Claude Desktop 中使用`;
      } catch (installError) {
        console.error('安装失败，尝试创建新服务:', installError);
        // 如果安装失败，继续创建新服务
      }
    }
    
    // 4. 创建新服务
    console.log('🔨 未找到合适的现有服务，开始创建新服务...');
    
    // 生成服务代码
    const code = await generateMCPCode(need.service_type, need.keywords);
    
    // 生成服务名称
    const serverName = `mcp-${need.service_type}-${Date.now()}`;
    
    // 创建服务
    const { serverId, configPath } = await createMCPServer('typescript', code, serverName);
    
    // 安装依赖
    const serverDir = path.dirname(configPath);
    await installDependencies(serverDir);
    
    return `✅ 已成功创建新的 MCP 服务: ${serverId}
📁 服务目录: ${serverDir}
📄 配置文件: ${configPath}
🚀 服务已准备就绪，可以在 Cursor 或 Claude Desktop 中使用`;
    
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

// CLI 接口
async function runCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🤖 MCP Host - 智能 MCP 服务管理器

使用方法:
  1. 直接运行: tsx src/index.ts "你的需求"
  2. Web 服务: tsx src/index.ts --server [端口]
  
示例:
  tsx src/index.ts "我需要一个天气查询服务"
  tsx src/index.ts "帮我创建一个翻译服务"
  tsx src/index.ts --server 3000
`);
    return;
  }
  
  if (args[0] === '--server') {
    const port = args[1] ? parseInt(args[1]) : 3000;
    await startWebServer(port);
  } else {
    const userInput = args.join(' ');
    const result = await handleUserNeed(userInput);
    console.log('\n' + result);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runCLI().catch(console.error);
} 