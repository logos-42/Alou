#!/usr/bin/env node
import { parseUserNeed } from './llm-native.js';
import { searchRegistry } from './registry.js';
import { generateMCPCode } from './llm.js';
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
import { ServiceManager } from './service-manager.js';
import { askLLM } from './llm.js';

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

// 获取服务的可用工具列表
async function getServiceTools(serviceId: string, serviceManager: ServiceManager): Promise<any[]> {
  try {
    // 启动服务（如果未运行）
    if (!serviceManager.list().some(s => s.name === serviceId && s.running)) {
      console.log(`🚀 启动服务: ${serviceId}`);
      await serviceManager.start(serviceId);
    }
    
    // 通过 ServiceManager 的内部客户端获取工具
    const client = (serviceManager as any).clients?.get(serviceId);
    if (client && typeof client.listTools === 'function') {
      console.log(`📋 获取 ${serviceId} 的工具列表...`);
      const toolsResponse = await client.listTools();
      const tools = toolsResponse?.tools || [];
      console.log(`✅ 找到 ${tools.length} 个工具:`, tools.map((t: any) => t.name));
      return tools;
    } else {
      console.log(`⚠️ 服务 ${serviceId} 的客户端未就绪或不支持 listTools`);
      return [];
    }
  } catch (error) {
    console.error(`❌ 获取服务 ${serviceId} 工具失败:`, error);
    return [];
  }
}

// 使用 LLM 规划工具调用
async function planToolCall(serviceId: string, need: any, userInput: string, serviceManager: ServiceManager): Promise<{ tool: string; args: any } | null> {
  try {
    // 获取服务的实际工具列表
    const tools = await getServiceTools(serviceId, serviceManager);
    
    // 格式化工具列表信息
    const toolsInfo = tools.length > 0 
      ? tools.map((tool: any) => `- ${tool.name}: ${tool.description || '无描述'}`).join('\n')
      : '无可用工具';

    const prompt = `
分析用户需求并生成 MCP 工具调用参数。

用户需求: ${userInput}
服务ID: ${serviceId}
服务类型: ${need.service_type}

可用工具列表:
${toolsInfo}

请根据用户需求选择最合适的工具，并生成相应的参数。直接返回 JSON 格式，不要包含其他内容：
{
  "tool": "工具名",
  "args": {
    "参数名": "参数值"
  }
}
`;

    const result = await askLLM(prompt);
    const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // 提取 JSON
    const jsonMatch = cleanResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('无法解析 LLM 响应');
  } catch (error) {
    console.error('⚠️ 工具规划失败，使用备用方案:', error);
    
    
    return null;
  }
}

// 格式化工具执行结果
function formatToolResult(result: any): string {
  if (!result) return '无结果';
  
  // 如果是 MCP 标准响应格式
  if (result.content && Array.isArray(result.content)) {
    return result.content
      .map((item: any) => {
        if (item.type === 'text') return item.text;
        if (item.type === 'image') return `[图片: ${item.url || item.data}]`;
        return JSON.stringify(item);
      })
      .join('\n');
  }
  
  // 如果是普通对象
  if (typeof result === 'object') {
    return JSON.stringify(result, null, 2);
  }
  
  // 其他情况
  return String(result);
}

// 启动服务→规划→调用→格式化 的统一流程
async function runServiceTool(serviceId: string, need: any, userInput: string): Promise<string | null> {
  const serviceManager = new ServiceManager();
  await serviceManager.loadAll();

  // 启动服务
  if (!serviceManager.list().some(s => s.name === serviceId && s.running)) {
    await serviceManager.start(serviceId);
  }

  // 规划工具调用
  const plan = await planToolCall(serviceId, need, userInput, serviceManager);
  if (!plan) return null;

  console.log(`📞 调用工具: ${plan.tool} with args:`, plan.args);
  const result = await serviceManager.call(serviceId, plan.tool, plan.args);
  return formatToolResult(result);
}

// 生成AI总结和引导回复
async function generateAISummary(
  serviceName: string, 
  serviceDescription: string, 
  userInput: string, 
  need: any,
  configPath?: string,
  githubUrl?: string
): Promise<string> {
  try {
    const prompt = `
用户刚刚成功安装了一个MCP服务，请生成一个友好的总结和引导回复。

服务信息:
- 服务名称: ${serviceName}
- 服务描述: ${serviceDescription}
- 用户原始需求: ${userInput}
- 需求类型: ${need.service_type}
- GitHub链接: ${githubUrl || '无'}

请生成一个包含以下内容的回复:
1. 🎉 庆祝成功安装
2. 📚 简要介绍服务功能和价值
3. ✨ 说明如何帮助用户完成任务
4. 🚀 提供后续行动建议
5. 💡 给出3-4个引导性问题，帮助用户充分利用这个工具

要求:
- 使用中文回复
- 语调友好专业
- 包含适当的emoji
- 重点说明这个服务如何解决用户的具体需求
- 引导问题要具体实用

直接返回完整的回复内容，不要包含其他说明。
`;

    const summary = await askLLM(prompt);
    return summary.trim();
  } catch (error) {
    console.error('⚠️ AI总结生成失败:', error);
    // 返回一个简单的默认总结
    return `�� **成功安装了您的专属助手！**

✅ **${serviceName}** 已经准备就绪，可以帮助您处理 **${need.service_type}** 相关的任务。

🚀 **接下来您可以：**
1. 按照配置说明在 Cursor 中设置服务
2. 尝试使用服务的各种功能
3. 根据您的具体需求调整和优化

💡 **有什么问题随时告诉我，我会帮您充分利用这个工具！**`;
  }
}

// 核心处理函数：处理用户需求
export async function handleUserNeed(userInput: string): Promise<string> {
  try {
    console.log('👤 用户需求:', userInput);
    
    // 1. 解析用户需求
    const need = await parseUserNeed(userInput);
    console.log('🧠 解析结果:', need);
    
    // 格式化需求详情（含深层需求、工作流、工具）
    const formatNeedDetails = (n: any): string => {
      let s = '';
      if (n.description) s += `📝 描述: ${n.description}\n`;
      if (n.deep_need) s += `🔍 深层需求: ${n.deep_need}\n`;
      if (n.workflows && n.workflows.length) {
        s += '📋 推荐工作流程:\n';
        for (const wf of n.workflows) {
          // 处理字符串数组格式的工作流
          if (typeof wf === 'string') {
            s += `  • ${wf}\n`;
          } else if (wf.name && wf.steps) {
            const steps = Array.isArray(wf.steps) ? wf.steps.join(' → ') : '';
            s += `  • ${wf.name}: ${steps}\n`;
          }
        }
      }
      if (n.mcp_tools && n.mcp_tools.length) {
        s += '🛠️ 关键 MCP 工具:\n';
        for (const t of n.mcp_tools) {
          // 处理字符串数组格式的工具
          if (typeof t === 'string') {
            s += `  • ${t}\n`;
          } else if (t.name && t.description) {
            s += `  • ${t.name}: ${t.description}\n`;
          }
        }
      }
      return s.trim();
    };

    const needDetails = formatNeedDetails(need);
    
    // 如果用户明确要求创建新服务，直接跳到创建步骤
    if (need.action === 'create') {
      console.log('🛠️ 用户要求创建新服务，跳过搜索步骤...');
      
      // 生成服务代码
      const code = await generateMCPCode(need.service_type, need.keywords, need);
      
      // 生成服务名称
      const serverName = `mcp-${need.service_type}-${Date.now()}`;
      
      // 创建服务
      const createResult = await createMCPServer('typescript', code, serverName, need.service_type);
      
      // 安装依赖
      const serverDir = path.dirname(createResult.configPath);
      await installDependencies(serverDir);
      
      // 尝试执行新创建的服务
      try {
        console.log('🚀 尝试使用新创建的服务完成任务...');
        
        const serviceManager = new ServiceManager();
        await serviceManager.loadAll();
        
        // 启动新服务
        if (serviceManager.list().some(s => s.name === createResult.serverId)) {
          await serviceManager.start(createResult.serverId);
          
          // 规划并执行工具调用
          const toolCallPlan = await planToolCall(createResult.serverId, need, userInput, serviceManager);
          
          if (toolCallPlan) {
            console.log(`📞 调用新创建服务的工具: ${toolCallPlan.tool}`);
            const result = await serviceManager.call(createResult.serverId, toolCallPlan.tool, toolCallPlan.args);
            const formattedResult = formatToolResult(result);
            
            return `✅ 已创建并使用新服务完成任务

🆕 服务信息:
- 名称: ${createResult.serverId}
- 目录: ${serverDir}

📊 执行结果:
${formattedResult}

${needDetails ? '\n💡 需求分析:\n' + needDetails : ''}`;
          }
        }
      } catch (error) {
        console.error('⚠️ 新服务执行失败，返回创建信息:', error);
      }
      
      // 如果执行失败，返回创建信息
      const configInstruction = generateConfigInstruction(createResult.serverId);
      return `✅ 已成功创建新的 MCP 服务: ${createResult.serverId}
📁 服务目录: ${serverDir}
📄 配置文件: ${createResult.configPath}
${needDetails ? needDetails + '\n' : ''}

⚠️ 服务已创建但自动执行失败，你可以手动调用：
node dist/index.js call "${createResult.serverId}" <tool_name> <args>

${configInstruction}`;
    }
    
    // 2. 先查询本地 Registry
    const registryHit = await searchRegistry([need.service_type, ...need.keywords]);

    if (registryHit) {
      console.log('🏷️ Registry 命中:', registryHit.title);
      
      // 确保服务已安装
      const serviceManager = new ServiceManager();
      await serviceManager.loadAll();
      
      // 检查服务是否已存在
      const serviceExists = serviceManager.list().some(s => s.name === registryHit.id);
      
      if (!serviceExists) {
        try {
          await installMCPServer(registryHit.title);
          await serviceManager.loadAll(); // 重新加载
        } catch {
          console.log('⚠️ Registry 工具安装失败，继续使用 MCP Compass 搜索');
        }
      }
      
      // 执行工具来完成用户需求
      try {
        console.log('🚀 启动服务并执行任务...');
        
        // 获取服务的工具列表
        if (!serviceManager.list().some(s => s.name === registryHit.id && s.running)) {
          await serviceManager.start(registryHit.id);
        }
        
        // 让 LLM 决定调用哪个工具以及参数
        const toolCallPlan = await planToolCall(registryHit.id, need, userInput, serviceManager);
        
        if (toolCallPlan) {
          console.log(`📞 调用工具: ${toolCallPlan.tool} with args:`, toolCallPlan.args);
          const result = await serviceManager.call(registryHit.id, toolCallPlan.tool, toolCallPlan.args);
          
          // 格式化结果
          const formattedResult = formatToolResult(result);
          
          const aiSummary = await generateAISummary(
            registryHit.title,
            `${registryHit.service_type} - ${registryHit.tags.join(', ')}`,
            userInput,
            need
          );
          
          return `✅ 已使用 ${registryHit.title} 服务完成任务

📊 执行结果:
${formattedResult}

${needDetails ? '\n💡 需求分析:\n' + needDetails : ''}

${aiSummary}`;
        }
      } catch (error) {
        console.error('❌ 工具执行失败:', error);
        return `⚠️ 找到了服务 ${registryHit.title}，但执行时出错: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    }
    
    // 3. 搜索现有服务（MCP Compass）
    const searchQuery = `${need.service_type} ${need.keywords.join(' ')}`;
    const searchResults = await searchMCPServers(searchQuery);
    
    // 4. 判断是否有合适的现有服务（降低阈值到 0.3，允许更多选择）
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
          
          // 尝试执行工具
          try {
            console.log('🚀 尝试使用新安装的服务完成任务...');
            const serviceId = suitableServer.title.split('/').pop() || suitableServer.title;
            const result = await runServiceTool(serviceId, need, userInput);
            
            if (result) {
              const aiSummary = await generateAISummary(
                suitableServer.title,
                suitableServer.description,
                userInput,
                need,
                undefined,
                suitableServer.github_url
              );
              
              return `✅ 已安装并使用 ${suitableServer.title} 服务完成任务

📊 执行结果:
${result}

${needDetails ? '\n💡 需求分析:\n' + needDetails : ''}

${aiSummary}`;
            }
          } catch (error) {
            console.error('⚠️ 服务执行失败:', error);
          }
          
          // 如果执行失败，返回安装成功信息
          const configInstruction = generateConfigInstruction(suitableServer.title);
          const aiSummary = await generateAISummary(
            suitableServer.title,
            suitableServer.description,
            userInput,
            need,
            undefined,
            suitableServer.github_url
          );
          
          return `✅ 已成功安装 ${suitableServer.title} 服务
📝 描述: ${suitableServer.description}
📄 配置文件已生成

⚠️ 服务已安装但自动执行失败，你可以手动调用

${configInstruction}

${aiSummary}`;
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
            const aiSummary = await generateAISummary(
              packageName,
              suitableServer.description,
              userInput,
              need,
              undefined,
              suitableServer.github_url
            );
            
            return `✅ 已成功安装 ${packageName} 服务
📝 描述: ${suitableServer.description}
📄 配置文件已生成
🔗 GitHub: ${suitableServer.github_url}

${configInstruction}

${aiSummary}`;
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
    const code = await generateMCPCode(need.service_type, need.keywords, need);
    
    // 生成服务名称
    const serverName = `mcp-${need.service_type}-${Date.now()}`;
    
    // 创建服务
    const createResult = await createMCPServer('typescript', code, serverName, need.service_type);
    
    // 安装依赖
    const serverDir = path.dirname(createResult.configPath);
    await installDependencies(serverDir);
    
    // 尝试执行新创建的服务
    try {
      console.log('🚀 尝试使用新创建的服务完成任务...');
      
      const serviceManager = new ServiceManager();
      await serviceManager.loadAll();
      
      // 启动新服务
      if (serviceManager.list().some(s => s.name === createResult.serverId)) {
        await serviceManager.start(createResult.serverId);
        
        // 规划并执行工具调用
        const toolCallPlan = await planToolCall(createResult.serverId, need, userInput, serviceManager);
        
        if (toolCallPlan) {
          console.log(`📞 调用新创建服务的工具: ${toolCallPlan.tool}`);
          const result = await serviceManager.call(createResult.serverId, toolCallPlan.tool, toolCallPlan.args);
          const formattedResult = formatToolResult(result);
          
          return `✅ 已创建并使用新服务完成任务

🆕 服务信息:
- 名称: ${createResult.serverId}
- 目录: ${serverDir}

📊 执行结果:
${formattedResult}

${needDetails ? '\n💡 需求分析:\n' + needDetails : ''}`;
        }
      }
    } catch (error) {
      console.error('⚠️ 新服务执行失败，返回创建信息:', error);
    }
    
    // 如果执行失败，返回创建信息
    const configInstruction = generateConfigInstruction(createResult.serverId);
    return `✅ 已成功创建新的 MCP 服务: ${createResult.serverId}
📁 服务目录: ${serverDir}
📄 配置文件: ${createResult.configPath}
${needDetails ? needDetails + '\n' : ''}

⚠️ 服务已创建但自动执行失败，你可以手动调用：
node dist/index.js call "${createResult.serverId}" <tool_name> <args>

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
async function waitForKeyPress(message: string = '按任意键退出...') {
  if (!isPkg) return; // 非打包环境不需要等待
  
  console.log(`\n${message}`);
  
  return new Promise<void>((resolve) => {
    if (process.platform === 'win32' && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        resolve();
      };
      process.stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.on('line', () => { rl.close(); resolve(); });
      rl.on('close', () => resolve());
    }
  });
}

// 交互式 CLI，允许用户连续输入需求
function interactiveCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('💬 请输入你的需求，输入 exit 退出:\n');
  const prompt = () => {
    rl.question('> ', async (answer) => {
      const trimmed = answer.trim();
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        rl.close();
        return;
      }
      if (trimmed.length === 0) {
        // 空输入，重新提示
        prompt();
        return;
      }
      try {
        const result = await handleUserNeed(trimmed);
        console.log('\n' + result + '\n');
      } catch (err) {
        console.error('处理失败:', err);
      }
      prompt();
    });
  };
  rl.on('close', async () => {
    // 交互式会话结束后，在打包环境中等待用户按键再退出，避免闪退
    await waitForKeyPress();
  });
  prompt();
}

// CLI 接口
async function runCLI() {
  const args = process.argv.slice(2);
  
  // 预加载服务
  const serviceManager = new ServiceManager();
  await serviceManager.loadAll();

  // 管理命令
  if (args[0] === 'list') {
    const list = serviceManager.list();
    console.log('\n📋 已登记服务（* 代表运行中）');
    list.forEach(i => console.log(` ${i.running ? '•*' : '• '} ${i.name}`));
    await waitForKeyPress();
    return;
  }
  if (args[0] === 'start' && args[1]) {
    await serviceManager.start(args[1]);
    console.log(`✅ 服务 ${args[1]} 已启动`);
    await waitForKeyPress();
    return;
  }
  if (args[0] === 'stop' && args[1]) {
    await serviceManager.stop(args[1]);
    console.log(`🛑 服务 ${args[1]} 已停止`);
    await waitForKeyPress();
    return;
  }
  if (args[0] === 'call' && args.length >= 3) {
    const [ , svc, tool, ...rest ] = args;
    let toolArgs: any = {};
    if (rest.length) {
      try { toolArgs = JSON.parse(rest.join(' ')); } catch { console.log('⚠️ 参数 JSON 解析失败，使用空对象'); }
    }
    const result = await serviceManager.call(svc, tool, toolArgs);
    console.log(JSON.stringify(result, null, 2));
    await waitForKeyPress();
    return;
  }
  
  if (args.length === 0) {
    console.log(`
🤖 MCP Host - 智能 MCP 服务管理器

使用方法:
  1. 直接输入需求后按回车 (交互式模式)
  2. 先输入 exit 退出交互式模式
  3. Web 服务: alou --server [端口]
  
示例:
  我需要一个天气查询服务
  帮我创建一个翻译服务
  alou --server 3000
`);
    // 启动交互式模式
    interactiveCLI();
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