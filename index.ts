#!/usr/bin/env node

import readline from 'readline';
import { showLoading, updateLoading, hideLoading } from './loading-indicator.js';
import { MCPServiceManager } from './mcp-client.js';
import { 
  parseUserNeed, 
  type UserNeed, 
  askLLM,
  aiOrchestrator,
  analyzeSearchResults,
  decideDownloadCommand,
  parseInstallRequest,
  decideErrorFix
} from './ai.js';
import type { HistoryEntry, AIOrchestratorAction } from './types.js';
import fs from 'fs';
import path from 'path';

// 声明全局process对象
declare const process: {
  env: Record<string, string>;
  cwd(): string;
  argv: string[];
  exit(code?: number): void;
  stdin: any;
  stdout: any;
  on(event: string, callback: Function): void;
  pkg?: any;
  execPath: string;
};

// CommonJS兼容性声明
declare const require: {
  (id: string): any;
  main?: any;
};
declare const module: any;

// 动态加载环境变量
(async () => {
  try {
    const dotenv = await import('dotenv').catch(() => null);
    if (dotenv && dotenv.config) {
      dotenv.config();
    }
  } catch (error) {
    console.warn('⚠️ 无法加载dotenv模块');
  }
})().catch(() => {});

// UserNeed接口从ai.ts导入

// 修复：添加优雅退出处理
let isShuttingDown = false;
let mcpManager: MCPServiceManager | null = null;

async function main() {
  console.log('🚀 欢迎使用 ALOU - 您的智能MCP服务助手!');
  console.log('🤖 完全由AI驱动的智能决策系统');
  console.log('💡 AI将分析您的需求并自动选择最佳策略');
  console.log('❌ 输入 "exit" 或按 Ctrl+C 退出\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 修复：注册优雅退出处理
  process.on('SIGINT', async () => {
    console.log('\n📋 收到退出信号...');
    await gracefulShutdown(rl);
  });

  process.on('SIGTERM', async () => {
    console.log('\n📋 收到终止信号...');
    await gracefulShutdown(rl);
  });

  try {
    mcpManager = new MCPServiceManager();
    await mcpManager.initialize();
    
    // 等待所有后台服务完成初始化
    console.log('✅ MCP服务管理器初始化完成');
    
    // 使用新的AI驱动循环
    await aiDrivenLoop(rl);

  } catch (error) {
    console.error('❌ 主程序运行失败:', error);
  } finally {
    await gracefulShutdown(rl);
  }
}
async function aiDrivenLoop(rl: readline.Interface): Promise<void> {
  const conversationHistory: HistoryEntry[] = [];
  
  // 初始化MCP服务管理器
  if (!mcpManager) {
    mcpManager = new MCPServiceManager();
    await mcpManager.initialize();
  }

  while (true) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question('🤖 请输入您的需求 (或输入 "exit" 退出): ', resolve);
    });

    if (userInput.toLowerCase() === 'exit') break;

    // 添加用户输入到历史
    conversationHistory.push({ 
      source: 'user', 
      content: userInput, 
      timestamp: Date.now(),
      metadata: {
        action: 'user_input',
        result: 'pending'
      }
    });

    let maxTurns = 10;
    while (maxTurns-- > 0) {
      try {
        // 调用AI大脑进行决策
        showLoading('AI 正在分析全局上下文...', 'spinner');
        const decision = await aiOrchestrator(conversationHistory);
        hideLoading();

        console.log(`\n🧠 AI 思考: ${decision.thought}`);
        console.log(`⚡️ AI 决策: ${decision.action} (置信度: ${Math.round(decision.confidence * 100)}%)`);
        if (decision.next_step_preview) {
          console.log(`🔮 下一步预览: ${decision.next_step_preview}`);
        }

        // 执行AI决策的行动
        let result: string;
        try {
          result = await executeAction(decision, mcpManager, userInput);
          
          // 添加成功结果到历史
          conversationHistory.push({ 
            source: 'system', 
            content: result, 
            timestamp: Date.now(),
            metadata: {
              action: decision.action,
              result: 'success',
              confidence: decision.confidence
            }
          });
          
          // 添加AI思考过程到历史（用于未来决策参考）
          conversationHistory.push({
            source: 'ai_thought',
            content: `行动: ${decision.action}, 思考: ${decision.thought}`,
            timestamp: Date.now(),
            metadata: {
              action: decision.action,
              confidence: decision.confidence
            }
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result = `System Error: ${errorMessage}`;
          
          // 添加错误结果到历史
          conversationHistory.push({ 
            source: 'error', 
            content: result, 
            timestamp: Date.now(),
            metadata: {
              action: decision.action,
              result: 'error'
            }
          });
        }

        console.log(`\n📋 执行结果:\n${result}\n`);

        // 判断是否完成任务或需要继续
        if (decision.action === 'respond_to_user' || 
            decision.action === 'install_server' && result.includes('✅') ||
            decision.action === 'use_installed_mcp' && result.includes('✅')) {
          break; // 任务完成，退出内循环
        }

        // 如果是某些需要继续处理的情况，继续循环
        if (decision.action === 'diagnose_error' || 
            decision.action === 'retry' ||
            result.includes('Error:')) {
          continue; // 继续尝试修复
        }

      } catch (aiError) {
        const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
        console.error(`❌ AI决策失败: ${errorMessage}`);
        
        // 添加AI决策错误到历史
        conversationHistory.push({
          source: 'error',
          content: `AI Decision Error: ${errorMessage}`,
          timestamp: Date.now(),
          metadata: {
            action: 'ai_decision_failed',
            result: 'error'
          }
        });
        
        // 降级到简单回复
        console.log('\n❌ AI决策系统遇到问题，请重新描述您的需求。\n');
        break;
      }
    }

    // 如果超过最大轮次，告知用户
    if (maxTurns <= 0) {
      console.log('\n⚠️ 已达到最大处理轮次，请尝试重新描述您的需求。\n');
    }
  }
}

async function executeAction(decision: AIOrchestratorAction, mcpManager: MCPServiceManager, userInput: string): Promise<string> {
  switch (decision.action) {
    case 'analyze_need': {
      const userNeed = await parseUserNeed(decision.parameters.userInput);
      const servers = await mcpManager.searchServers(decision.parameters.userInput, userNeed);
      return `✅ 需求分析完成: ${JSON.stringify(userNeed, null, 2)}\n🔍 找到 ${servers.length} 个相关服务`;
    }
    
    case 'search_services': {
      const userNeed = await parseUserNeed(decision.parameters.query);
      const servers = await mcpManager.searchServers(decision.parameters.query, userNeed);
      return formatSearchResults(servers);
    }
    
    case 'decide_from_search_results': {
      const userNeed = await parseUserNeed(decision.parameters.userInput);
      const allServers = await mcpManager.searchServers(decision.parameters.userInput, userNeed);
      const analysis = await decideDownloadCommand(allServers, decision.parameters.userInput);
      
      if (analysis.selectedServer) {
        return `🎯 AI推荐: ${analysis.selectedServer.title}\n📋 理由: ${analysis.reason}\n⚡️ 安装命令: ${analysis.downloadCommand}`;
      } else {
        return `❌ 未找到合适的服务\n📋 原因: ${analysis.reason}${analysis.suggestion ? `\n💡 建议: ${analysis.suggestion}` : ''}`;
      }
    }
    
    case 'install_server': {
      const installResult = await mcpManager.installServer(decision.parameters.server);
      return installResult.message;
    }
    
    case 'use_installed_mcp': {
      // 使用已安装的MCP服务
      const { serviceId, operation, parameters } = decision.parameters;
      return `🔧 正在使用MCP服务: ${serviceId}\n📋 操作: ${operation}\n⚡️ 参数: ${JSON.stringify(parameters)}`;
    }
    
    case 'diagnose_error': {
      const fix = await decideErrorFix(decision.parameters.errorMessage, decision.parameters.context?.server);
      return `🔍 错误诊断完成\n🛠️ 修复方案: ${fix.action}\n📋 原因: ${fix.reason}`;
    }
    
    case 'create_server': {
      const userNeed = await parseUserNeed(decision.parameters.userInput);
      const createResult = await mcpManager.createServer(userNeed, decision.parameters.userInput);
      return createResult.message;
    }
    
    case 'query_memory': {
      return await executeMemoryQuery(decision.parameters.query, await parseUserNeed(decision.parameters.query));
    }
    
    case 'respond_to_user': {
      let response = decision.parameters.message;
      if (decision.parameters.suggestions && decision.parameters.suggestions.length > 0) {
        response += `\n\n💡 建议:\n${decision.parameters.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`;
      }
      return response;
    }
    
    case 'retry': {
      return `🔄 正在重试上一个操作: ${decision.parameters.lastAction}`;
    }
    
    default:
      throw new Error(`未知的行动类型: ${decision.action}`);
  }
}
/**
 * 格式化搜索结果
 */
function formatSearchResults(servers: any[]): string {
  let resultMessage = '';
  if (servers.length === 0) {
    resultMessage += '❌ 未找到相关的MCP服务';
  } else {
    resultMessage += `✅ 找到 ${servers.length} 个相关服务:\n\n`;
    servers.forEach((server, index) => {
      resultMessage += `${index + 1}. ${server.title} - ${server.description}\n`;
      resultMessage += `   🏷️ ID: ${server.id}\n`;
      resultMessage += `   🌐 项目: ${server.github_url || 'N/A'}\n`;
      resultMessage += `   📦 命令: ${server.command} ${(server.args || []).join(' ')}\n`;
      if (server.tags && server.tags.length > 0) {
        resultMessage += `   🏷️ 标签: ${server.tags.join(', ')}\n`;
      }
      resultMessage += '\n';
    });
  }
  return resultMessage;
}

/**
 * 提示用户输入
 */
function askUser(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * 执行Memory查询操作
 */
async function executeMemoryQuery(userInput: string, need: UserNeed): Promise<string> {
  try {
    console.log('🧠 执行Memory服务查询...');
    
    if (!mcpManager) {
      return '❌ 服务管理器未初始化';
    }

    // 根据用户输入判断需要什么类型的查询
    if (userInput.includes('已安装') || userInput.includes('已下载') || userInput.includes('mcp服务') || userInput.includes('记忆') || userInput.includes('工具')) {
      // 使用专门的方法获取已安装服务信息
      const { configData, memoryRecords } = await mcpManager.getInstalledServersInfo();
      
      let resultMessage = '';
      
      // 显示配置文件中的服务
      if (configData && configData.length > 0) {
        resultMessage += `\n📦 配置文件中的已安装服务 (${configData.length}个):\n`;
        configData.forEach((server: any, index: number) => {
          resultMessage += `${index + 1}. 🔧 **${server.title || server.id}**\n`;
          resultMessage += `   📋 描述: ${server.description || '无描述'}\n`;
          resultMessage += `   🏷️ ID: ${server.id}\n`;
          if (server.tags && server.tags.length > 0) {
            resultMessage += `   🏷️ 标签: ${server.tags.join(', ')}\n`;
          }
          resultMessage += '\n';
        });
      } else {
        resultMessage += '\n📝 配置文件中暂无已安装的MCP服务\n';
      }
      
      // 显示memory中的记录
      if (memoryRecords && memoryRecords.content && memoryRecords.content.length > 0) {
        resultMessage += `\n💾 记忆中的已安装服务记录 (${memoryRecords.content.length}个):\n`;
        memoryRecords.content.forEach((record: any, index: number) => {
          try {
            // 尝试解析记录内容
            if (record.text) {
              const lines = record.text.split('\n');
              const titleLine = lines.find((line: string) => line.includes('已安装MCP服务:'));
              if (titleLine) {
                const serviceName = titleLine.replace('已安装MCP服务:', '').trim();
                resultMessage += `${index + 1}. 💾 **${serviceName}**\n`;
                
                // 提取关键信息
                const idLine = lines.find((line: string) => line.includes('服务ID:'));
                if (idLine) {
                  resultMessage += `   ��️ ${idLine.trim()}\n`;
                }
                
                const descLine = lines.find((line: string) => line.includes('描述:'));
                if (descLine) {
                  resultMessage += `   📋 ${descLine.trim()}\n`;
                }
                resultMessage += '\n';
              }
            }
          } catch (parseError) {
            resultMessage += `${index + 1}. 💾 记录解析失败\n`;
          }
        });
      } else {
        resultMessage += '\n💾 记忆中暂无已安装服务记录\n';
      }
      
      // 添加调试信息
      resultMessage += `\n🔧 调试信息:\n`;
      resultMessage += `- 配置文件路径存在: ${configData ? '是' : '否'}\n`;
      resultMessage += `- Memory记录结构: ${memoryRecords ? JSON.stringify(Object.keys(memoryRecords)) : 'null'}\n`;
      
      return resultMessage;
      
    } else if (userInput.includes('历史') || userInput.includes('记录') || userInput.includes('过去')) {
      // 查询历史记录
      const historyQuery = await mcpManager.queryMemory('recall_memory', {
        query: userInput,
        n_results: 5
      });
      
      return `📚 历史记录查询结果:\n${JSON.stringify(historyQuery, null, 2)}`;
      
    } else {
      // 通用记忆检索
      const generalQuery = await mcpManager.queryMemory('retrieve_memory', {
        query: userInput,
        n_results: 5
      });
      
      return `🔍 记忆检索结果:\n${JSON.stringify(generalQuery, null, 2)}`;
    }
    
  } catch (error) {
    console.error('❌ Memory查询失败:', error);
    return `❌ Memory查询失败: ${error instanceof Error ? error.message : '未知错误'}`;
  }
}

async function gracefulShutdown(rl: readline.Interface): Promise<void> {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  
  try {
    console.log('🧹 正在清理资源...');
    
    // 清理readline接口
    rl.close();
    
    // 清理MCP服务连接
    if (mcpManager) {
      await mcpManager.cleanup();
    }
    
    console.log('✅ 资源清理完成');
    console.log('👋 感谢使用 ALOU!');
    
  } catch (error) {
    console.error('⚠️ 清理过程中发生错误:', error);
  } finally {
    process.exit(0);
  }
}

// PKG和内置Node.js环境检测
function isPkgEnvironment(): boolean {
  return typeof process !== 'undefined' && !!process.pkg;
}

function getAppRoot(): string {
  if (isPkgEnvironment()) {
    // PKG环境下，获取exe文件所在目录
    return require('path').dirname(process.execPath);
  }
  return process.cwd();
}

function getPortableNodePath(): string | null {
  const appRoot = getAppRoot();
  const platform = require('os').platform();
  const path = require('path');
  
  if (isPkgEnvironment()) {
    // PKG环境下，Node.js被内置在资源中
    const portableNodeDir = path.join(appRoot, 'portable-node', platform, 'node');
    const nodeBinary = platform === 'win32' ? 'node.exe' : 'bin/node';
    const nodePath = path.join(portableNodeDir, nodeBinary);
    
    if (require('fs').existsSync(nodePath)) {
      return nodePath;
    }
  } else {
    // 开发环境下，从项目目录查找
    const portableNodeDir = path.join(process.cwd(), 'portable-node', platform, 'node');
    const nodeBinary = platform === 'win32' ? 'node.exe' : 'bin/node';
    const nodePath = path.join(portableNodeDir, nodeBinary);
    
    if (require('fs').existsSync(nodePath)) {
      return nodePath;
    }
  }
  
  return null;
}

async function checkEnvironmentDependencies(): Promise<void> {
    console.log('🔧 检查环境依赖...');
    
    // 首先尝试使用内置Node.js
    const portableNodePath = getPortableNodePath();
    
    if (portableNodePath) {
        console.log(`✅ 发现内置Node.js: ${portableNodePath}`);
        // 设置环境变量，让后续操作使用内置Node.js
        process.env.PORTABLE_NODE_PATH = portableNodePath;
        process.env.PORTABLE_NODE_DIR = require('path').dirname(portableNodePath);
        
        try {
            // 测试内置Node.js是否工作
            const { execSync } = require('child_process');
            const version = execSync(`"${portableNodePath}" --version`, { encoding: 'utf8' }).trim();
            console.log(`✅ 内置Node.js版本: ${version}`);
            
            // 测试NPX是否可用
            const npmPath = require('path').join(process.env.PORTABLE_NODE_DIR, require('os').platform() === 'win32' ? 'npx.cmd' : 'bin/npx');
            if (require('fs').existsSync(npmPath)) {
                console.log('✅ 内置NPX工具可用');
                process.env.PORTABLE_NPX_PATH = npmPath;
            } else {
                console.log('⚠️ 内置NPX工具不可用，部分功能可能受限');
            }
        } catch (error) {
            console.log('⚠️ 内置Node.js测试失败，回退到系统Node.js');
        }
    } else {
        console.log('🔍 未发现内置Node.js，检查系统Node.js...');
        
        // 回退到原有的Node.js检测逻辑
        try {
            const childProcess = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(childProcess.exec);
            
            const { stdout } = await execAsync('node --version');
            const nodeVersion = stdout.trim();
            console.log(`✅ 系统Node.js版本: ${nodeVersion}`);
            
            // 检查npx是否可用
            try {
                await execAsync('npx --version');
                console.log('✅ 系统NPX工具可用');
            } catch {
                console.log('⚠️ 系统NPX工具不可用，部分MCP服务安装功能可能受限');
            }
        } catch (error) {
            console.log('❌ 未检测到Node.js环境');
            console.log('💡 建议：安装Node.js以获得完整功能体验');
            console.log('   下载地址: https://nodejs.org/');
            console.log('🔄 当前将以基础模式运行...\n');
        }
    }
    
    console.log('✅ 环境依赖检测完成\n');
}

// 启动主程序
// PKG环境或直接运行时启动
const shouldStart = () => {
  try {
    // 检查是否是主模块（CommonJS）
    if (typeof require !== 'undefined' && require.main === module) {
      return true;
    }
    // 备用检查：检查process.argv
    return process.argv[1] && (
      process.argv[1].includes('index.js') || 
      process.argv[1].includes('alou') ||
      process.argv[1].endsWith('.exe')
    );
  } catch {
    // 最终备用：总是启动
    return true;
  }
};

if (shouldStart()) {
  main().catch(console.error);
} 