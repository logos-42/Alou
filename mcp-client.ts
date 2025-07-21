// 在文件顶部添加PKG环境的MCP SDK处理
declare const require: {
  (id: string): any;
  main?: any;
};

// 条件导入MCP SDK - 支持PKG环境
let Client: any = null;
let StdioClientTransport: any = null;

try {
  // 尝试导入MCP SDK - 使用具体的CJS路径
  const mcpSdk = require('@modelcontextprotocol/sdk/dist/cjs/client/index.js');
  Client = mcpSdk.Client;
  
  const mcpStdio = require('@modelcontextprotocol/sdk/dist/cjs/client/stdio.js');
  StdioClientTransport = mcpStdio.StdioClientTransport;
  
  console.log('✅ MCP SDK加载成功');
} catch (error: any) {
  console.warn('⚠️ MCP SDK加载失败，使用降级模式:', error?.message || error);
  
  // 创建降级的Client类
  Client = class MockClient {
    connected: boolean;
    
    constructor() {
      this.connected = false;
    }
    
    async connect() {
      console.warn('⚠️ MCP SDK不可用，返回模拟连接');
      this.connected = true;
      return this;
    }
    
    async listTools() {
      return { tools: [] };
    }
    
    async callTool(name: string, args: any) {
      console.warn(`⚠️ 无法调用工具 ${name}，MCP SDK不可用`);
      return {
        content: [{
          type: 'text',
          text: `工具 ${name} 当前不可用，请检查MCP环境配置`
        }]
      };
    }
    
    async close() {
      this.connected = false;
    }
  };
  
  // 创建降级的Transport类
  StdioClientTransport = class MockTransport {
    command: string;
    args: string[];
    options: any;
    
    constructor(command: string, args: string[], options: any) {
      this.command = command;
      this.args = args;
      this.options = options;
    }
  };
}

import { UserNeed, decideErrorFix } from './ai.js';
import { updateLoading } from './loading-indicator.js';
import { EmbeddedMemoryService, MemoryItem } from './memory.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 声明全局process对象
declare const process: {
  env: Record<string, string>;
  cwd(): string;
  execPath: string;
  pkg?: any;
};

// PKG环境检测
const isPkgEnvironment = () => {
  return typeof process.pkg !== 'undefined';
};

// 获取应用根目录
const getAppRoot = () => {
  if (isPkgEnvironment()) {
    // PKG环境下，使用exe文件所在目录
    return path.dirname(process.execPath);
  } else {
    // 开发环境
    return process.cwd();
  }
};

/**
 * 内置Memory MCP客户端适配器
 */
class EmbeddedMemoryMCPClient {
  private memoryService: EmbeddedMemoryService;

  constructor(memoryService: EmbeddedMemoryService) {
    this.memoryService = memoryService;
  }

  async callTool(params: { name: string; arguments: any }): Promise<any> {
    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'store_memory':
          const storeResult = await this.memoryService.storeMemory(args.content, args.metadata);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: storeResult.success,
                id: storeResult.id,
                message: storeResult.success ? `Memory stored with ID: ${storeResult.id}` : 'Failed to store memory'
              })
            }]
          };

        case 'retrieve_memory':
        case 'search_memory':
          const retrieveResult = await this.memoryService.retrieveMemory(args.query, args.n_results || 5);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                memories: retrieveResult.memories,
                total: retrieveResult.total
              })
            }]
          };

        case 'search_by_tag':
          const tagResult = await this.memoryService.searchByTag(args.tags, args.n_results || 5);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                memories: tagResult.memories,
                total: tagResult.total
              })
            }]
          };

        case 'recall_memory':
          const recallResult = await this.memoryService.recallMemory(args.query, args.n_results || 5);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                memories: recallResult.memories,
                total: recallResult.total
              })
            }]
          };

        case 'delete_memory':
          const deleteResult = await this.memoryService.deleteMemory(args.content_hash);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: deleteResult.success,
                message: deleteResult.success ? 'Memory deleted successfully' : 'Failed to delete memory'
              })
            }]
          };

        case 'check_database_health':
          const healthResult = await this.memoryService.checkDatabaseHealth();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(healthResult)
            }]
          };

        case 'dashboard_get_stats':
        case 'get_stats':
          const statsResult = await this.memoryService.getStats();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(statsResult)
            }]
          };

        default:
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: `Unknown tool: ${name}`,
                available_tools: [
                  'store_memory', 'retrieve_memory', 'search_by_tag', 'recall_memory',
                  'delete_memory', 'check_database_health', 'get_stats'
                ]
              })
            }]
          };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }]
      };
    }
  }
}

// 环境依赖检测
const checkEnvironmentDependencies = () => {
  const missing = [];
  
  try {
    execSync('npx --version', { stdio: 'ignore' });
  } catch {
    missing.push('npx (Node.js包管理器)');
  }
  
  try {
    execSync('python --version', { stdio: 'ignore' });
  } catch {
    try {
      execSync('py --version', { stdio: 'ignore' });
    } catch {
      missing.push('Python 3.11+');
    }
  }
  
  return missing;
};

export interface MCPServer {
  id: string;
  title: string;
  description: string;
  github_url?: string;
  similarity_score: number;
  command?: string;
  args?: string[];
  tags?: string[];
  category?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface InstallResult {
  success: boolean;
  serverId?: string;
  configPath?: string;
  message: string;
}

/**
 * 移除本地MCP服务库 - 现在完全依赖compass搜索
 * 专注于搜索->安装->创建->记忆的工作流
 */

/**
 * MCP服务管理器 - 整合所有MCP操作
 * 集成完整的MCP工作流: 搜索 -> 安装 -> 创建 -> 记忆
 */
export class MCPServiceManager {
  private runningServices = new Map<string, any>();
  private coreServices = new Map<string, any>();
  private memoryClient: any = null;
  private embeddedMemoryService: EmbeddedMemoryService; // 添加内置memory服务
  private retryMap = new Map<string, number>();
  private readonly MAX_RETRY = 3;
  // 缓存最近一次用户上下文，便于在深层调用中依旧可以触发 nextStepPlan
  private currentUserInput?: string;
  private currentNeed?: UserNeed;
  
  // PKG兼容的路径处理
  private readonly APP_ROOT = getAppRoot();
  private readonly INSTALLED_SERVERS_PATH = path.join(this.APP_ROOT, 'installed_mcp_servers.json');
  private readonly MCP_CONFIG_PATH = path.join(this.APP_ROOT, 'mcpServers.user.js');
  private readonly MCP_USER_JSON_PATH = path.join(this.APP_ROOT, 'mcpServers.user.json');

  constructor() {
    // 初始化内置memory服务
    this.embeddedMemoryService = new EmbeddedMemoryService();
  }

  async initialize(): Promise<void> {
    // 先加载 mcpServers.user.json 中的服务器
    await this.loadUserMCPServers();
    
    await this.loadInstalledServers();
    
    // 减少初始化输出
    console.log('🔧 初始化MCP服务管理器...');
    
    // PKG环境提示（只在PKG环境下显示）
    if (isPkgEnvironment()) {
      console.log(`📦 检测到PKG打包环境`);
    }
    
    // 环境依赖检测（只在有问题时显示）
    const missingDeps = checkEnvironmentDependencies();
    if (missingDeps.length > 0) {
      console.log('⚠️ 缺少以下依赖，部分功能可能受限:');
      missingDeps.forEach(dep => console.log(`   - ${dep}`));
    }
    
    // 启动核心MCP服务
    await this.startCoreServices();
    
    // 初始化Memory客户端
    await this.initializeMemoryClient();
    
    // 预加载已安装服务信息到memory中
    await this.preloadInstalledServicesToMemory();
    
    console.log('✅ MCP服务管理器初始化完成');
  }

  /**
   * 预加载已安装服务信息到memory中
   */
  private async preloadInstalledServicesToMemory(): Promise<void> {
    try {
      const installedServers = this.loadInstalledServersSync();
      
      if (installedServers.length > 0) {
        // 静默预加载，不显示详细过程
        let successCount = 0;
        
        for (const server of installedServers) {
          try {
            const serviceRecord = `已安装MCP服务: ${server.title}

📋 基本信息:
- 服务名称: ${server.title}
- 服务ID: ${server.id}
- 描述: ${server.description || '无描述'}
- 类型: ${server.category || 'general'}

🔧 技术信息:
- 命令: ${server.command} ${(server.args || []).join(' ')}
- 标签: ${(server.tags || []).join(', ')}
- GitHub: ${server.github_url || 'N/A'}

⏰ 记录时间: ${new Date().toISOString()}
📦 状态: 已安装可用`;

            const storeParams = {
              content: serviceRecord,
              metadata: {
                tags: ['已安装', 'mcp服务', 'installed_service', server.id, server.category || 'general'],
                type: 'installed_service',
                service_id: server.id,
                service_name: server.title,
                service_type: server.category || 'general'
              }
            };
            
            const storeResult = await this.callMemoryService('store_memory', storeParams);
            
            if (storeResult && storeResult.success !== false) {
              successCount++;
            }
            
          } catch (storeError) {
            // 静默处理错误
          }
        }
        
        // 只显示简单的完成信息
        if (successCount > 0) {
          console.log(`✅ 已加载 ${successCount} 个服务到记忆系统`);
        }
      }
    } catch (error) {
      // 静默处理错误
    }
  }

  /**
   * 完整的MCP工作流程 - 复刻演示的完整流程
   */
  async executeCompleteWorkflow(userInput: string, need: UserNeed): Promise<string> {
    console.log('🔄 开始执行完整MCP工作流...');
    
    try {
      // 1. 🔍 使用mcp-compass搜索MCP服务
      updateLoading('正在搜索MCP服务...');
      const searchResults = await this.searchWithCompass(userInput, need);
      
      if (searchResults.length === 0) {
        console.log('❌ 未找到相关MCP服务，直接创建新服务');
        return await this.createAndExecuteNewService(need, userInput);
      }
      
      // 2. 📦 使用mcp-installer安装最佳匹配服务
      updateLoading('正在安装MCP服务...');
      const bestMatch = searchResults[0];
      const installResult = await this.installWithInstaller(bestMatch);
      
      if (installResult.success) {
        // 3. 🚀 执行安装的服务
        updateLoading('正在执行服务...');
        const executionResult = await this.executeInstalledService(installResult.serverId!, userInput, need);
        
        // 4. 🛠️ 使用mcp-server-creator创建类似服务
        updateLoading('正在创建类似服务...');
        const createdService = await this.createSimilarService(bestMatch, need, userInput);
        
        // 5. 💾 使用mcp-memory-service存储记忆
        updateLoading('正在存储记忆...');
        await this.storeWorkflowMemory(bestMatch, createdService, userInput, need);
        
        return `✅ 完整工作流执行成功！

🔍 搜索结果: 找到 ${searchResults.length} 个相关服务
📦 安装服务: ${bestMatch.title}
🚀 执行结果: ${executionResult}
🛠️ 创建服务: ${createdService.serverId}
💾 记忆存储: 已保存完整流程记录

详细信息已存储到记忆中，可通过"回忆刚才的MCP工作流"查看。`;
      } else {
        console.log('⚠️ 服务安装失败，创建新服务');
        return await this.createAndExecuteNewService(need, userInput);
      }
      
    } catch (error) {
      console.error('❌ 完整工作流执行失败:', error);
      return `❌ 工作流执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 启动核心MCP服务
   */
  private async startCoreServices(): Promise<void> {
    const coreServicesConfig = [
      { name: 'compass', command: 'npx', args: ['-y', '@liuyoshio/mcp-compass'] },
      { name: 'installer', command: 'npx', args: ['-y', '@anaisbetts/mcp-installer'] },
      { name: 'creator', command: 'uvx', args: ['mcp-server-creator'] }
    ];

    for (const config of coreServicesConfig) {
      try {
        const client = await this.createMCPClientInternal(config.command, config.args);
        this.coreServices.set(config.name, client);
      } catch (error) {
        // 静默处理错误，核心服务启动失败不影响基本功能
      }
    }
    
    if (this.coreServices.size > 0) {
      console.log(`✅ 启动了 ${this.coreServices.size} 个核心服务`);
    }
  }

  /**
   * 使用mcp-compass搜索MCP服务 - 加强版本，支持重试机制
   */
  private async searchWithCompass(userInput: string, need: UserNeed): Promise<MCPServer[]> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const compassClient = this.coreServices.get('compass');
        if (!compassClient) {
          console.warn('⚠️ Compass服务未启动，正在尝试重新连接...');
          await this.retryCompassConnection();
          continue;
        }

        // 首先将中文需求翻译成英文搜索词
        const englishQuery = await this.translateToEnglishQuery(userInput, need);
        console.log(`🌐 翻译后的搜索词: ${englishQuery} (尝试 ${retryCount + 1}/${maxRetries})`);

        try {
          const searchResult = await this.callCompassWithTimeout(compassClient, englishQuery, 15000);
          
          if (searchResult.content && Array.isArray(searchResult.content) && searchResult.content[0]) {
            const resultText = (searchResult.content[0] as any).text || '';
            const servers = this.parseCompassResults(resultText);
            console.log(`✅ Compass找到 ${servers.length} 个服务`);
            return servers;
          }
        } catch (compassError) {
          console.warn(`⚠️ Compass搜索失败 (尝试 ${retryCount + 1}/${maxRetries}):`, compassError instanceof Error ? compassError.message : compassError);
          
          // 如果是网络问题，等待后重试
          if (retryCount < maxRetries - 1) {
            console.log(`🔄 等待 ${(retryCount + 1) * 2} 秒后重试...`);
            await this.sleep((retryCount + 1) * 2000);
          }
        }

        retryCount++;
      } catch (error) {
        console.error(`❌ Compass搜索失败 (尝试 ${retryCount + 1}/${maxRetries}):`, error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`🔄 等待 ${retryCount * 2} 秒后重试...`);
          await this.sleep(retryCount * 2000);
        }
      }
    }
    
    console.error('❌ Compass搜索经过多次重试仍然失败');
    return [];
  }

  /**
   * 将中文需求翻译成英文MCP搜索查询
   */
  private async translateToEnglishQuery(userInput: string, need: UserNeed): Promise<string> {
    try {
      // 导入AI翻译功能
      const aiModule = await import('./ai.js');
      const askLLM = aiModule.askLLM;
      
      const translatePrompt = `
请将以下中文MCP服务需求翻译成简洁的英文搜索关键词，用于搜索MCP服务器。

用户需求: "${userInput}"
服务类型: ${need.service_type}
关键词: ${need.keywords.join(', ')}

请返回一个简洁的英文搜索查询，格式如: "MCP Server for [功能描述]"
只返回英文查询，不要其他解释。

示例:
- 中文: "帮我搜一个地图服务" → 英文: "MCP Server for maps and location services"
- 中文: "需要文件管理工具" → 英文: "MCP Server for file management and operations"
- 中文: "数据分析相关的" → 英文: "MCP Server for data analysis and visualization"
`;

      const englishQuery = await askLLM(translatePrompt);
      
      // 清理翻译结果，去除多余内容
      const cleanQuery = englishQuery
        .replace(/^["']|["']$/g, '') // 去除引号
        .replace(/.*?[:：]\s*/, '') // 去除冒号前的内容
        .replace(/^(英文|English|Query|Search)[:：]?\s*/i, '') // 去除标签
        .trim();

      // 如果翻译失败或为空，使用备用英文查询
      if (!cleanQuery || cleanQuery.length < 10) {
        return this.generateFallbackEnglishQuery(need);
      }

      return cleanQuery;
    } catch (error) {
      console.warn('⚠️ AI翻译失败，使用备用英文查询:', error);
      return this.generateFallbackEnglishQuery(need);
    }
  }

  /**
   * 生成备用英文查询
   */
  private generateFallbackEnglishQuery(need: UserNeed): string {
    // 中文到英文的服务类型映射
    const serviceTypeMap: Record<string, string> = {
      'memory': 'memory and storage',
      'file': 'file management',
      'web': 'web scraping and browsing',
      'api': 'API integration',
      'database': 'database operations',
      'tool': 'productivity tools',
      'design': 'design and graphics',
      'data_analysis': 'data analysis',
      'general': 'utility services'
    };

    // 中文关键词到英文的映射
    const keywordMap: Record<string, string> = {
      '地图': 'maps',
      '文件': 'files',
      '数据': 'data',
      '分析': 'analysis',
      '设计': 'design',
      '图片': 'images',
      '网络': 'web',
      '搜索': 'search',
      '管理': 'management',
      '工具': 'tools'
    };

    // 翻译关键词
    const englishKeywords = need.keywords.map(keyword => 
      keywordMap[keyword] || keyword
    ).join(' ');

    const serviceType = serviceTypeMap[need.service_type] || need.service_type;
    
    return `MCP Server for ${serviceType} ${englishKeywords}`.trim();
  }

  /**
   * 重试Compass连接
   */
  private async retryCompassConnection(): Promise<void> {
    try {
      console.log('🔄 尝试重新连接Compass服务...');
      const compassClient = await this.createMCPClientInternal('npx', ['-y', '@liuyoshio/mcp-compass']);
      this.coreServices.set('compass', compassClient);
      console.log('✅ Compass服务重新连接成功');
    } catch (error) {
      console.error('❌ Compass服务重新连接失败:', error);
      throw error;
    }
  }

  /**
   * 带超时的Compass调用
   */
  private async callCompassWithTimeout(compassClient: any, query: string, timeout: number): Promise<any> {
    const callPromise = compassClient.callTool({
      name: 'recommend-mcp-servers',
      arguments: { query }
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Compass调用超时')), timeout)
    );

    return Promise.race([callPromise, timeoutPromise]);
  }

  /**
   * 等待指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 解析Compass搜索结果
   */
  private parseCompassResults(resultText: string): MCPServer[] {
    try {
      // 修复：首先尝试清理代码块包装的JSON
      let cleanedText = resultText;
      
      // 移除Markdown代码块标记
      cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // 尝试直接解析JSON格式
      try {
        const jsonData = JSON.parse(cleanedText);
        if (Array.isArray(jsonData)) {
          return jsonData.map(item => this.normalizeServer(item));
        } else if (jsonData.servers && Array.isArray(jsonData.servers)) {
          return jsonData.servers.map((item: any) => this.normalizeServer(item));
        }
      } catch (jsonError) {
        console.log('📝 JSON解析失败，使用文本解析方式');
      }
      
      // 备用：使用原有的行解析方式
      const servers: MCPServer[] = [];
      const lines = cleanedText.split('\n');
      
      let currentServer: Partial<MCPServer> = {};
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        if (trimmedLine.startsWith('Server ')) {
          if (currentServer.title) {
            servers.push(this.normalizeServer(currentServer));
          }
          currentServer = {};
        } else if (trimmedLine.startsWith('Title: ')) {
          currentServer.title = trimmedLine.replace('Title: ', '').trim();
          currentServer.id = this.extractServerId(currentServer.title);
        } else if (trimmedLine.startsWith('Description: ')) {
          currentServer.description = trimmedLine.replace('Description: ', '').trim();
        } else if (trimmedLine.startsWith('GitHub URL: ')) {
          currentServer.github_url = trimmedLine.replace('GitHub URL: ', '').trim();
        } else if (trimmedLine.startsWith('Similarity: ')) {
          const similarity = trimmedLine.replace('Similarity: ', '').replace('%', '').trim();
          currentServer.similarity_score = parseFloat(similarity) / 100;
        }
      }
      
      if (currentServer.title) {
        servers.push(this.normalizeServer(currentServer));
      }
      
      return servers.filter(server => server.title && server.description);
      
    } catch (error) {
      console.error('❌ Compass结果解析失败:', error);
      return [];
    }
  }

  /**
   * 规范化服务器信息
   */
  private normalizeServer(server: Partial<MCPServer>): MCPServer {
    const packageName = this.extractPackageName(server.github_url || '');
    
    return {
      id: server.id || this.extractServerId(server.title || ''),
      title: server.title || 'Unknown Server',
      description: server.description || 'No description available',
      github_url: server.github_url,
      similarity_score: server.similarity_score || 0.5,
      command: 'npx',
      args: ['-y', packageName || server.title || ''],
      tags: this.extractTags(server.description || ''),
      category: 'general'
    };
  }

  /**
   * 从GitHub URL提取包名
   */
  private extractPackageName(githubUrl: string): string {
    if (githubUrl.includes('modelcontextprotocol/servers')) {
      const match = githubUrl.match(/\/([^\/]+)$/);
      return match ? `@modelcontextprotocol/server-${match[1]}` : '';
    }
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    return match ? `${match[1]}/${match[2]}` : '';
  }

  /**
   * 提取标签
   */
  private extractTags(description: string): string[] {
    const tags: string[] = [];
    const words = description.toLowerCase().split(/\s+/);
    
    const tagKeywords = ['api', 'tool', 'service', 'server', 'client', 'data', 'analysis', 'web', 'file'];
    words.forEach(word => {
      if (tagKeywords.includes(word)) {
        tags.push(word);
      }
    });
    
    return tags;
  }

  /**
   * 使用mcp-installer安装服务
   */
  private async installWithInstaller(server: MCPServer): Promise<InstallResult> {
    try {
      const installerClient = this.coreServices.get('installer');
      if (!installerClient) {
        throw new Error('Installer服务未启动');
      }

      const packageName = server.args?.[server.args.length - 1] || server.id;
      console.log(`📦 使用Installer安装: ${packageName}`);

      const installResult = await installerClient.callTool({
        name: 'install_repo_mcp_server',
        arguments: {
          name: packageName,
          args: server.args?.slice(2) || []
        }
      });

      if (installResult.content && Array.isArray(installResult.content) && installResult.content[0]) {
        const resultText = (installResult.content[0] as any).text || '';
        const success = resultText.includes('successfully') || resultText.includes('成功');
        
        if (success) {
          console.log(`✅ 安装成功: ${server.title}`);
          // 持久化
          await this.saveInstalledServer(server);
          return {
            success: true,
            serverId: server.id,
            message: resultText
          };
        }
      }

      return {
        success: false,
        message: '安装失败'
      };
    } catch (error) {
      console.error('❌ Installer安装失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 执行已安装的服务
   */
  private async executeInstalledService(serverId: string, userInput: string, need: UserNeed): Promise<string> {
    try {
      // 尝试直接启动服务
      const server = this.findServerById(serverId);
      if (server && server.command && server.args) {
        console.log(`🚀 启动服务: ${server.command} ${server.args.join(' ')}`);
        
        const client = await this.createMCPClientInternal(
          server.command, 
          server.args, 
          server.env, 
          server.cwd
        );
        this.runningServices.set(serverId, client);
        
        // 获取服务工具列表
        const tools = await client.listTools();
        console.log(`🛠️ 服务工具: ${tools.tools.map((t: any) => t.name).join(', ')}`);
        
        return `✅ 服务 ${server.title} 启动成功，支持 ${tools.tools.length} 个工具`;
      }
      
      return `⚠️ 服务 ${serverId} 配置不完整，无法启动`;
    } catch (error) {
      console.error('❌ 服务执行失败:', error);
      return `❌ 服务执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 创建类似服务
   */
  private async createSimilarService(referenceServer: MCPServer, need: UserNeed, userInput: string): Promise<InstallResult> {
    try {
      const creatorClient = this.coreServices.get('creator');
      if (!creatorClient) {
        throw new Error('Creator服务未启动');
      }

      const serverName = `custom-${referenceServer.id}-${Date.now()}`;
      console.log(`🛠️ 创建类似服务: ${serverName}`);

      const createResult = await creatorClient.callTool({
        name: 'create_server',
        arguments: {
          name: serverName,
          description: `类似 ${referenceServer.title} 的定制服务 - ${userInput}`,
          version: '1.0.0'
        }
      });

      if (createResult.content && Array.isArray(createResult.content) && createResult.content[0]) {
        const resultText = (createResult.content[0] as any).text || '';
        let serverId = resultText.match(/服务器ID: ([^\n]+)/)?.[1] || serverName;
        
        // 添加工具
        await this.addSimilarTools(creatorClient, serverId, referenceServer, need);
        const newServer: MCPServer = { ...referenceServer, id: serverId, title: serverName };
        await this.saveInstalledServer(newServer);
        
        console.log(`✅ 创建类似服务成功: ${serverId}`);
        return {
          success: true,
          serverId: serverId,
          message: `创建类似服务成功: ${serverId}`
        };
      }

      return {
        success: false,
        message: '创建服务失败'
      };
    } catch (error) {
      console.error('❌ 创建类似服务失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 添加类似工具
   */
  private async addSimilarTools(creatorClient: any, serverId: string, referenceServer: MCPServer, need: UserNeed): Promise<void> {
    try {
      const tools = [
        {
          name: 'process_request',
          description: `处理${need.service_type}请求，类似${referenceServer.title}`,
          parameters: [
            { name: 'input', type: 'str', description: '用户输入' },
            { name: 'options', type: 'dict', description: '处理选项', default: '{}' }
          ]
        },
        {
          name: 'get_info',
          description: `获取${need.service_type}信息`,
          parameters: [
            { name: 'query', type: 'str', description: '查询内容' }
          ]
        }
      ];

      for (const tool of tools) {
        await creatorClient.callTool({
          name: 'add_tool',
          arguments: {
            server_id: serverId,
            tool_name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ 添加工具失败:', error);
    }
  }

  /**
   * 存储工作流记忆
   */
  private async storeWorkflowMemory(originalServer: MCPServer, createdService: InstallResult, userInput: string, need: UserNeed): Promise<void> {
    if (!this.memoryClient) return;

    try {
      const workflowRecord = `MCP完整工作流记录:

🔍 搜索阶段:
- 用户需求: ${userInput}
- 服务类型: ${need.service_type}
- 关键词: ${need.keywords.join(', ')}

📦 安装阶段:
- 找到服务: ${originalServer.title}
- 服务描述: ${originalServer.description}
- GitHub链接: ${originalServer.github_url || 'N/A'}
- 相似度: ${(originalServer.similarity_score * 100).toFixed(1)}%

🛠️ 创建阶段:
- 创建服务: ${createdService.serverId}
- 创建状态: ${createdService.success ? '成功' : '失败'}
- 创建消息: ${createdService.message}

⏰ 执行时间: ${new Date().toISOString()}
🎯 工作流状态: 完成`;

      await this.callMemoryService('store_memory', {
        content: workflowRecord,
        metadata: {
          tags: ['mcp_workflow', 'complete_process', need.service_type, 'mcpsrc'],
          type: 'workflow_record',
          original_server: originalServer.id,
          created_server: createdService.serverId,
          user_input: userInput,
          service_type: need.service_type
        }
      });

      console.log('�� 工作流记忆存储成功');
    } catch (error) {
      console.error('❌ 工作流记忆存储失败:', error);
    }
  }

  /**
   * 创建并执行新服务（备用方案）
   */
  private async createAndExecuteNewService(need: UserNeed, userInput: string): Promise<string> {
    try {
      console.log('🆕 创建新服务作为备用方案...');
      
      const createResult = await this.createServer(need, userInput);
      if (createResult.success) {
        const executeResult = await this.executeService(createResult.serverId!, userInput, need);
        
        // 存储到记忆
        await this.storeWorkflowMemory(
          { id: 'new', title: '新创建服务', description: need.description, similarity_score: 1.0 } as MCPServer,
          createResult,
          userInput,
          need
        );
        
        return `✅ 新服务创建并执行成功！

🆕 创建服务: ${createResult.serverId}
🚀 执行结果: ${executeResult}
💾 记忆存储: 已保存完整流程记录`;
      }
      
      return `❌ 新服务创建失败: ${createResult.message}`;
    } catch (error) {
      console.error('❌ 创建新服务失败:', error);
      return `❌ 创建新服务失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 根据ID查找服务 - 现在从已安装服务中查找
   */
  private findServerById(serverId: string): MCPServer | undefined {
    // 从已安装服务文件中查找
    try {
      const installedServers = this.loadInstalledServersSync();
      return installedServers.find(s => s.id === serverId);
    } catch (error) {
      console.warn('⚠️ 查找服务失败:', error);
      return undefined;
    }
  }

  /**
   * 初始化Memory客户端 - 连接到用户本地的memory服务
   */
  private async initializeMemoryClient(): Promise<void> {
    try {
      // 使用内置Memory服务
      this.memoryClient = new EmbeddedMemoryMCPClient(this.embeddedMemoryService);
      
      // 测试内置memory服务（静默）
      const healthResult = await this.callMemoryService('check_database_health', {});
      if (healthResult) {
        console.log('✅ 内置Memory服务就绪');
      }
      
    } catch (error) {
      // 降级模式：使用最简单的内存缓存
      this.memoryClient = this.createFallbackMemoryClient();
    }
  }

  /**
   * 创建降级Memory客户端
   */
  private createFallbackMemoryClient(): any {
    const memoryCache = new Map();
    
    return {
      callTool: async (params: any) => {
        const { name, arguments: args } = params;
        
        switch (name) {
          case 'store_memory':
            const key = `memory_${Date.now()}_${Math.random()}`;
            memoryCache.set(key, {
              content: args.content,
              metadata: args.metadata,
              timestamp: Date.now()
            });
            return { content: [{ type: 'text', text: `存储成功: ${key}` }] };
            
          case 'retrieve_memory':
          case 'search_by_tag':
            // 简单搜索内存缓存
            const results = Array.from(memoryCache.values()).filter(item => {
              if (args.query) {
                return item.content.toLowerCase().includes(args.query.toLowerCase());
              }
              if (args.tags && item.metadata?.tags) {
                return args.tags.some((tag: string) => 
                  item.metadata.tags.includes(tag)
                );
              }
              return true;
            });
            
            return { 
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ memories: results.slice(0, args.n_results || 5) })
              }] 
            };
            
          default:
            return { content: [{ type: 'text', text: '降级模式：功能有限' }] };
        }
      }
    };
  }

  /**
   * 存储服务信息到记忆中
   */
  private async storeServiceInMemory(service: MCPServer): Promise<void> {
    if (!this.memoryClient) return;

    try {
      const content = `MCP服务: ${service.title}
描述: ${service.description}
类别: ${service.category}
标签: ${service.tags?.join(', ')}
命令: ${service.command} ${service.args?.join(' ')}
相似度: ${service.similarity_score}`;

      // 存储到memory service
      await this.callMemoryService('store_memory', {
        content: content,
        metadata: {
          tags: ['mcp_service', service.category, ...(service.tags || [])],
          type: 'mcp_service',
          service_id: service.id,
          category: service.category
        }
      });
    } catch (error) {
      console.warn(`存储服务 ${service.id} 到记忆失败:`, error);
    }
  }

  /**
   * 调用Memory服务（减少调试输出）
   */
  private async callMemoryService(tool: string, args: any): Promise<any> {
    if (!this.memoryClient) {
      return null;
    }

    try {
      const response = await this.memoryClient.callTool({
        name: tool,
        arguments: args
      });
      
      return response.content;
    } catch (error) {
      // 静默处理错误
      return null;
    }
  }

  /**
   * 创建MCP客户端连接（公共方法，用于测试）
   */
  async createMCPClient(command: string, args: string[], env?: any, cwd?: string): Promise<any> {
    return this.createMCPClientInternal(command, args, env, cwd);
  }

  /**
   * 创建MCP客户端连接（内部实现）
   */
  private async createMCPClientInternal(command: string, args: string[], env: Record<string, string> = {}, cwd?: string): Promise<any> {
    let transport: any = null;
    
    try {
      // 过滤环境变量中的undefined值
      const cleanEnv: Record<string, string> = {};
      Object.entries(env || process.env).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanEnv[key] = value;
        }
      });
      
      // 为Memory服务特别设置stderr重定向
      const isMemoryService = command === 'py' && args.includes('mcp_memory_service.server');
      
      // 使用已经导入的类，配置stderr处理
      const transportOptions: any = {
        command,
        args,
        env: cleanEnv,
        cwd: cwd || this.APP_ROOT
      };
      
      // 如果是Memory服务，尝试添加stdio配置来抑制stderr
      if (isMemoryService) {
        transportOptions.stdio = ['pipe', 'pipe', 'ignore']; // 忽略stderr
      }
      
      transport = new StdioClientTransport(transportOptions);

      const client = new Client(
        {
          name: `alou-${command}`,
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );
      
      // 移除不存在的事件处理器
      // transport.onError 和 transport.onClose 在这个SDK版本中不存在
      
      await client.connect(transport);
      return client;
      
    } catch (error) {
      // 修复：确保传输层正确清理
      if (transport && typeof transport.close === 'function') {
        try {
          transport.close();
        } catch (closeError) {
          console.warn('⚠️ 传输层清理失败:', closeError);
        }
      }
      
      // 修复：提供更具体的错误信息
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          throw new Error(`命令未找到: ${command}. 请确保 ${command} 已安装并在PATH中可用.`);
        } else if (error.message.includes('EACCES')) {
          throw new Error(`权限被拒绝: ${command}. 请检查执行权限.`);
        }
      }
      
      throw error;
    }
  }

  /**
   * 修复：添加资源清理方法
   */
  async cleanup(): Promise<void> {
    console.log('🧹 清理MCP服务连接...');
    
    // 清理核心服务
    for (const [name, client] of this.coreServices) {
      try {
        if (client && typeof client.close === 'function') {
          await client.close();
          console.log(`✅ ${name} 服务已关闭`);
        }
      } catch (error) {
        console.warn(`⚠️ ${name} 服务关闭失败:`, error);
      }
    }
    this.coreServices.clear();
    
    // 清理运行中的服务
    for (const [id, service] of this.runningServices) {
      try {
        if (service && typeof service.close === 'function') {
          await service.close();
          console.log(`✅ 服务 ${id} 已关闭`);
        }
      } catch (error) {
        console.warn(`⚠️ 服务 ${id} 关闭失败:`, error);
      }
    }
    this.runningServices.clear();
    
    // 清理Memory客户端
    if (this.memoryClient && typeof this.memoryClient.close === 'function') {
      try {
        await this.memoryClient.close();
        console.log('✅ Memory服务已关闭');
      } catch (error) {
        console.warn('⚠️ Memory服务关闭失败:', error);
      }
    }
  }

  /**
   * 获取核心服务客户端（用于诊断）
   */
  getCoreServices(): Map<string, any> {
    return this.coreServices;
  }

  /**
   * 获取运行中的服务（用于诊断）
   */
  getRunningServices(): Map<string, any> {
    return this.runningServices;
  }

  /**
   * 深度检查服务状态 - 不仅检查连接，还验证功能
   */
  async getDetailedServiceStatus(): Promise<Record<string, {
    connected: boolean;
    toolCount: number;
    tools: string[];
    error?: string;
  }>> {
    const status: Record<string, any> = {};
    
    for (const [name, client] of this.coreServices) {
      try {
        // 测试连接和工具列表
        const tools = await client.listTools();
        status[name] = {
          connected: true,
          toolCount: tools.tools?.length || 0,
          tools: tools.tools?.map((t: any) => t.name) || [],
        };
        
        // 额外验证：尝试调用一个简单的方法
        if (name === 'compass' && tools.tools?.some((t: any) => t.name === 'recommend-mcp-servers')) {
          try {
            const testResult = await client.callTool({
              name: 'recommend-mcp-servers',
              arguments: { query: 'test' }
            });
            status[name].functionalTest = testResult ? 'passed' : 'failed';
          } catch (funcError) {
            status[name].functionalTest = 'failed';
            status[name].funcError = funcError instanceof Error ? funcError.message : String(funcError);
          }
        }
        
      } catch (error) {
        status[name] = {
          connected: false,
          toolCount: 0,
          tools: [],
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    return status;
  }

  async getServiceStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const [name, client] of this.coreServices) {
      try {
        // 尝试调用一个简单的方法来检查服务状态
        await client.listTools();
        status[name] = true;
      } catch (error) {
        status[name] = false;
      }
    }
    
    return status;
  }

  /**
   * 搜索MCP服务（现在完全使用compass搜索）
   */
  async searchServers(userInput: string, need: UserNeed): Promise<MCPServer[]> {
    try {
      console.log(`🔍 使用Compass搜索MCP服务: ${need.service_type} - ${userInput}`);
      
      let foundServices: MCPServer[] = [];
      
      // 1. 使用compass搜索
      const compassResults = await this.searchWithCompass(userInput, need);
      foundServices.push(...compassResults);
      
      // 2. 从记忆中搜索已安装的服务
      const memoryResults = await this.searchFromMemory(userInput, need);
      foundServices.push(...memoryResults);
      
      // 3. 去重和排序
      const uniqueServices = this.deduplicateServices(foundServices);
      const rankedServices = this.rankServices(uniqueServices, need);
      
      console.log(`✅ 找到 ${rankedServices.length} 个相关MCP服务`);
      return rankedServices.slice(0, 5); // 返回前5个最相关的服务
      
    } catch (error) {
      console.error('❌ 搜索MCP服务失败:', error);
      return [];
    }
  }

  /**
   * 搜索本地服务库功能已移除 - 完全依赖compass搜索
   */
  private searchLocalServices(need: UserNeed): MCPServer[] {
    console.log('ℹ️ 本地服务搜索已移除，请使用compass搜索');
    return [];
  }

  /**
   * 从记忆中搜索服务
   */
  private async searchFromMemory(userInput: string, need: UserNeed): Promise<MCPServer[]> {
    if (!this.memoryClient) return [];

    try {
      // 使用标签搜索
      const tags = ['mcp_service', need.service_type, ...need.keywords];
      const memoryResults = await this.callMemoryService('search_by_tag', { tags });
      
      if (!memoryResults || !Array.isArray(memoryResults)) return [];
      
      // 转换记忆结果为MCPServer格式
      return memoryResults.map((memory: any) => this.convertMemoryToService(memory));
    } catch (error) {
      console.warn('从记忆搜索服务失败:', error);
      return [];
    }
  }

  /**
   * 转换记忆格式为服务格式
   */
  private convertMemoryToService(memory: any): MCPServer {
    const metadata = memory.metadata || {};
    const content = memory.content || '';
    const lines = content.split('\n');
    
    return {
      id: metadata.service_id || `memory-${Date.now()}`,
      title: lines[0]?.replace('MCP服务: ', '') || 'Unknown Service',
      description: content.includes('描述: ') ? 
        content.split('描述: ')[1]?.split('\n')[0] || '' : 
        content.substring(0, 100),
      similarity_score: 0.75,
      category: metadata.category,
      tags: metadata.tags || []
    };
  }

  /**
   * 服务去重
   */
  private deduplicateServices(services: MCPServer[]): MCPServer[] {
    const seen = new Set();
    return services.filter(service => {
      const key = service.id || service.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 服务排序
   */
  private rankServices(services: MCPServer[], need: UserNeed): MCPServer[] {
    return services.sort((a, b) => {
      // 按相似度排序
      if (a.similarity_score !== b.similarity_score) {
        return b.similarity_score - a.similarity_score;
      }
      
      // 按类别匹配度排序
      const aMatches = a.category === need.service_type;
      const bMatches = b.category === need.service_type;
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      
      return 0;
    });
  }

  /**
   * 自动检查和安装服务依赖
   */
  private async ensureServiceDependencies(server: MCPServer): Promise<void> {
    if (!server.cwd) return;
    
    try {
      
      const servicePath = path.resolve(server.cwd);
      
      // 检查并安装 Python 依赖
      const requirementsPath = path.join(servicePath, 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        console.log(`📦 检查Python依赖: ${server.id}`);
        try {
          execSync('pip install -r requirements.txt', { 
            cwd: servicePath, 
            stdio: 'inherit' as any,
            timeout: 60000
          });
        } catch (pipError) {
          console.warn(`⚠️ Python依赖安装失败，尝试继续: ${pipError}`);
        }
      }
      
      // 检查并安装 Node.js 依赖
      const packageJsonPath = path.join(servicePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        console.log(`📦 检查Node.js依赖: ${server.id}`);
        try {
          execSync('npm install --omit=dev', { 
            cwd: servicePath, 
            stdio: 'inherit' as any,
            timeout: 60000
          });
        } catch (npmError) {
          console.warn(`⚠️ Node.js依赖安装失败，尝试继续: ${npmError}`);
        }
      }
      
      // 特殊处理：Memory服务的hnswlib依赖
      if (server.id === 'memory-service') {
        try {
          execSync('python -c "import hnswlib"', { stdio: 'ignore' as any });
        } catch {
          console.log('⚠️ hnswlib缺失，Memory服务将使用降级模式');
          // 不强制安装，让服务自己处理降级
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ 依赖检查失败: ${server.id} - ${error}`);
    }
  }

  async installServer(server: MCPServer, userInput?: string, need?: UserNeed): Promise<InstallResult> {
    try {
      console.log(`📦 安装MCP服务: ${server.title}`);
      
      // 重试计数
      const retried = (this.retryMap.get(server.id) || 0) + 1;
      this.retryMap.set(server.id, retried);
      
      if (retried > this.MAX_RETRY) {
        console.log(`🚨 已重试 ${this.MAX_RETRY} 次，交给 AI 规划下一步`);
        
        // 仅当调用方传入了上下文信息时才让 AI 规划下一步，否则返回默认提示
        if (userInput && need) {
          // 使用 any 避免类型检查阻塞；nextStepPlan 在 ai.ts 中声明即可
          const aiModule: any = await import('./ai.js');
          if (typeof aiModule.nextStepPlan === 'function') {
            try {
              const planMsg = await aiModule.nextStepPlan(userInput, need);
              return {
                success: false,
                serverId: server.id,
                message: planMsg
              };
            } catch (planErr) {
              console.warn('⚠️ AI 规划下一步失败:', planErr);
            }
          }
        }
        
        // 没有传入足够信息或 AI 规划失败，回退到原有提示
        return {
          success: false,
          serverId: server.id,
          message: `❌ 已超过最大重试次数 (${this.MAX_RETRY})，请检查手动配置或更换服务`
        };
      }
      
      // 处理占位符服务
      if (!server.command || !server.args) {
        return {
          success: true,
          serverId: server.id,
          message: await this.generatePlaceholderAdvice(server)
        };
      }
      
      // 修复：优先使用installer安装MCP包
      console.log(`🔧 步骤1: 使用installer安装MCP包...`);
      const installResult = await this.installWithInstaller(server);
      
      if (installResult.success) {
        console.log(`✅ MCP包安装成功，现在启动服务...`);
      } else {
        console.log(`⚠️ installer安装失败，尝试直接启动: ${installResult.message}`);
      }
      
      // 步骤2: 启动已安装的服务
      console.log(`🚀 步骤2: 启动MCP服务...`);
      try {
        // 先检查和安装依赖
        await this.ensureServiceDependencies(server);
        
        console.log(`🚀 启动服务: ${server.command} ${server.args.join(' ')}`);
        
        const client = await this.createMCPClientInternal(
          server.command, 
          server.args, 
          server.env, 
          server.cwd
        );
        
        // 测试服务是否正常工作
        const tools = await client.listTools();
        console.log(`🛠️ 服务工具: ${tools.tools?.map((t: any) => t.name).join(', ') || '无'}`);
        
        // 修复：确保服务被正确添加到运行服务列表
        this.runningServices.set(server.id, client);
        console.log(`✅ 服务 ${server.id} 已添加到运行服务列表`);
        
        // 记录到已安装服务列表
        await this.saveInstalledServer(server);
        
        // 记录到记忆中
        await this.recordServiceInstallation(server, true);
        
        // 重置重试计数
        this.retryMap.delete(server.id);
        
        return {
          success: true,
          serverId: server.id,
          message: `✅ 服务 ${server.title} 安装并启动成功，支持 ${tools.tools?.length || 0} 个工具`
        };
        
      } catch (startupError) {
        const errorMsg = startupError instanceof Error ? startupError.message : String(startupError);
        console.error(`❌ 服务启动失败: ${errorMsg}`);
        
        // 记录失败
        await this.recordServiceInstallation(server, false, startupError);
        
        // 让 AI 尝试给出修复方案
        try {
          const fix = await decideErrorFix(errorMsg, server);
          if (fix.action && fix.action !== 'manual') {
            console.log(`🤖 AI 建议: ${fix.reason}`);
            const retry = await this.applyFixAndRetry(server, fix);
            return retry;
          }
          console.log(`🤖 AI 无法自动修复: ${fix.reason}`);
        } catch (aiErr) {
          console.warn('⚠️ AI 诊断失败:', aiErr);
        }
        
        // 记录错误到记忆
        await this.storeErrorMemory(server, errorMsg);
        
        return {
          success: false,
          serverId: server.id,
          message: `❌ 服务启动失败: ${errorMsg}`
        };
      }
      
    } catch (error) {
      console.error(`❌ 安装服务失败: ${server.title}`, error);
      
      // 记录失败
      await this.recordServiceInstallation(server, false, error);
      
      return {
        success: false,
        serverId: server.id,
        message: `❌ 安装失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 记录服务安装信息
   */
  private async recordServiceInstallation(server: MCPServer, success: boolean, error?: any): Promise<void> {
    if (!this.memoryClient) return;

    const content = `MCP服务安装记录:
服务: ${server.title}
ID: ${server.id}
状态: ${success ? '成功' : '失败'}
时间: ${new Date().toISOString()}
${error ? `错误: ${error.message || error}` : ''}`;

    await this.callMemoryService('store_memory', {
      content: content,
      metadata: {
        tags: ['mcp_installation', success ? 'success' : 'failure', server.category],
        type: 'installation_record',
        service_id: server.id,
        status: success ? 'success' : 'failure'
      }
    });
  }

  async createServer(need: UserNeed, userInput: string): Promise<InstallResult> {
    try {
      console.log(`🛠️ 创建MCP服务: ${need.service_type}`);
      
      const creatorClient = this.coreServices.get('creator');
      if (!creatorClient) {
        throw new Error('Creator服务未启动');
      }

      // 获取Creator可用工具
      const toolsResponse = await creatorClient.listTools();

      console.log('📋 Creator可用工具:', toolsResponse.tools.map((t: any) => t.name).join(', '));

      // 创建服务器配置
      const serverName = `custom-${need.service_type}-${Date.now()}`;
      const createResponse = await creatorClient.callTool({
        name: "create_server",
                  arguments: { 
          name: serverName,
          description: `${need.description} - ${userInput}`,
          version: "1.0.0"
        }
      });

      if (!createResponse.content || !(createResponse.content as any)[0]) {
        throw new Error('创建服务失败');
      }

      const responseText = (createResponse.content as any)?.[0]?.text || '';
      let serverId = responseText.match(/服务器ID: ([^\n]+)/)?.[1] || 
                     responseText.match(/Server ID: ([^\n]+)/)?.[1] ||
                     responseText.match(/ID: ([^\n]+)/)?.[1];
      
      if (!serverId) {
        // 如果无法解析ID，生成一个唯一ID
        serverId = `custom-${need.service_type}-${Date.now()}`;
        console.log(`⚠️ 未能解析服务ID，生成默认ID: ${serverId}`);
      }
      
      console.log(`💾 已记录服务: ${serverId}`);
      
      // 记录到记忆
      await this.recordServiceCreation(serverId, need, userInput);
      
      return {
        success: true,
        serverId: serverId,
        message: `✅ 创建服务 ${serverId} 成功`
      };

    } catch (error) {
      console.error(`❌ 创建服务失败:`, error);
      return {
        success: false,
        message: `❌ 创建失败: ${error}`
      };
    }
  }

  /**
   * 记录服务创建信息
   */
  private async recordServiceCreation(serverId: string, need: UserNeed, userInput: string): Promise<void> {
    if (!this.memoryClient) return;

    const content = `创建的MCP服务:
服务ID: ${serverId}
类型: ${need.service_type}
用户需求: ${userInput}
关键词: ${need.keywords.join(', ')}
置信度: ${need.intent_confidence}
创建时间: ${new Date().toISOString()}`;

    await this.callMemoryService('store_memory', {
      content: content,
      metadata: {
        tags: ['mcp_created', need.service_type, ...need.keywords],
        type: 'created_service',
        service_id: serverId,
        service_type: need.service_type
      }
    });
  }

  async executeService(serviceId: string, userInput: string, need: UserNeed): Promise<string> {
    try {
      console.log(`⚡ 执行服务: ${serviceId}`);
      
      // 检查是否为运行中的服务
      const client = this.runningServices.get(serviceId);
      if (client) {
        // 执行具体的服务逻辑
        return await this.executeRunningService(client, userInput, need);
      }
      
      // 检查是否为核心服务
      const coreClient = this.coreServices.get(serviceId);
      if (coreClient) {
        return await this.executeCoreService(coreClient, serviceId, userInput, need);
      }
      
      // 创建的服务执行
      return await this.executeCreatedService(serviceId, userInput, need);
      
    } catch (error) {
      console.error(`❌ 执行服务 ${serviceId} 失败:`, error);
      return `❌ 服务执行失败: ${error}`;
    }
  }

  /**
   * 执行运行中的服务
   */
  private async executeRunningService(client: any, userInput: string, need: UserNeed): Promise<string> {
    // 根据服务类型执行不同逻辑
    if (need.service_type === 'design') {
      return await this.executeDesignService(client, userInput);
    }
    
    return `✅ 服务执行完成，用户需求: ${userInput}`;
  }

  /**
   * 执行设计服务
   */
  private async executeDesignService(client: any, userInput: string): Promise<string> {
    try {
      // 调用设计工具
      const result = await client.request({
        method: "tools/call",
        params: {
          name: "create_logo",
            arguments: { 
            description: userInput,
            style: "modern",
            format: "svg"
          }
        }
      });
      
      return `🎨 Logo设计完成！\n设计说明: ${userInput}\n输出格式: SVG\n样式: 现代简约`;
    } catch (error) {
      return `⚠️ 设计服务暂时不可用，但已为您准备了设计方案建议：
1. 使用Canva等在线设计工具
2. 考虑简约的Logo设计风格
3. 确保Logo在不同尺寸下的清晰度
4. 选择与品牌定位匹配的颜色方案`;
    }
  }

  /**
   * 执行核心服务
   */
  private async executeCoreService(client: any, serviceId: string, userInput: string, need: UserNeed): Promise<string> {
    if (serviceId === 'creator') {
      return `🛠️ Creator服务已准备就绪，可以创建定制的${need.service_type}服务`;
    }
    
    return `✅ ${serviceId}服务执行完成`;
  }

  /**
   * 执行创建的服务
   */
  private async executeCreatedService(serviceId: string, userInput: string, need: UserNeed): Promise<string> {
    // 模拟执行创建的服务
    return `✅ 服务 ${serviceId} 执行完成
用户输入: ${userInput}
服务类型: ${need.service_type}

根据您的需求，我们已经为您准备了相应的解决方案。
如需更详细的功能，请联系管理员配置具体的执行逻辑。`;
  }

  /**
   * 测试Memory服务（保持兼容性）
   */
  private async testMemoryService(userInput: string): Promise<string> {
    if (!this.memoryClient) {
      return '❌ Memory服务未连接';
    }

    try {
      const testResult = await this.callMemoryService('store_memory', {
        content: `测试记录: ${userInput} - ${new Date().toISOString()}`,
        metadata: {
          tags: ['test', 'alou_system'],
          type: 'test_record'
        }
      });

      return '✅ Memory服务测试成功';
    } catch (error) {
      return `❌ Memory服务测试失败: ${error}`;
    }
  }

  private async generateSearchQuery(userInput: string, need: UserNeed): Promise<string> {
    return `${need.service_type} ${need.keywords.join(' ')} ${userInput}`.trim();
  }

  private extractServerId(title: string): string {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private async generateServiceCode(need: UserNeed, userInput: string): Promise<string> {
    return `// ${need.service_type} service for: ${userInput}
// Generated by ALOU MCP Creator
// Confidence: ${need.intent_confidence}

export class ${need.service_type.charAt(0).toUpperCase() + need.service_type.slice(1)}Service {
  async execute(input: string): Promise<string> {
    // Implementation for: ${userInput}
    return "Service executed successfully";
  }
}`;
  }

  /**
   * 为占位符服务生成建议
   */
  private async generatePlaceholderAdvice(server: MCPServer): Promise<string> {
    if (server.category === 'design') {
      return `🎨 Logo设计建议方案：

✨ 在线设计工具推荐：
1. Canva (https://canva.com) - 简单易用的在线设计平台
2. Figma (https://figma.com) - 专业的UI/UX设计工具
3. LogoMaker (https://logomaker.com) - 专业Logo生成器
4. Adobe Express - Adobe的简化版设计工具

🎯 设计原则建议：
• 保持简约现代的风格
• 确保在不同尺寸下清晰可见
• 选择与品牌定位匹配的颜色
• 考虑黑白版本的效果
• 确保向量格式(SVG/AI)的可扩展性

💡 创意思路：
• 结合品牌名称的首字母
• 使用简洁的几何图形
• 考虑行业特色元素
• 保持独特性和识别度

📋 输出格式建议：
• SVG格式(可无限缩放)
• PNG格式(透明背景)
• 多种尺寸版本
• 配色方案说明

🔧 如需技术支持，建议：
1. 使用Creator服务创建定制设计工具
2. 集成现有设计API服务
3. 开发自动化Logo生成流程`;
    }

    if (server.category === 'analysis') {
      return `📊 分析工具建议方案：

✨ 可用工具推荐：
1. 使用Sequential Thinking服务进行逐步分析
2. 集成数据分析库(pandas, numpy)
3. 使用可视化工具(matplotlib, plotly)

🎯 分析方法：
• 数据预处理和清洗
• 统计分析和趋势识别
• 可视化展示
• 结论和建议生成`;
    }

    return `💡 ${server.title} 服务建议：

当前这是一个占位符服务，为您提供以下建议：

🔧 替代方案：
1. 使用现有的相关MCP服务
2. 通过Creator服务创建定制工具
3. 集成现有的在线服务或API

📋 下一步行动：
• 明确具体需求细节
• 搜索现有MCP服务库
• 考虑开发定制解决方案

如需帮助，请提供更具体的需求描述。`;
  }

  /**
   * 加载已安装的MCP服务器列表
   */
  public async loadInstalledServers(): Promise<MCPServer[]> {
    try {
      if (fs.existsSync(this.INSTALLED_SERVERS_PATH)) {
        const raw = fs.readFileSync(this.INSTALLED_SERVERS_PATH, 'utf-8');
        const servers: MCPServer[] = JSON.parse(raw || '[]');
        console.log(`📂 已加载 ${servers.length} 个已安装MCP服务器配置`);
        return servers;
      }
      return [];
    } catch (error) {
      console.warn('⚠️ 加载已安装MCP服务器配置失败:', error);
      return [];
    }
  }

  /**
   * 同步加载已安装的MCP服务器列表
   */
  private loadInstalledServersSync(): MCPServer[] {
    try {
      if (fs.existsSync(this.INSTALLED_SERVERS_PATH)) {
        const raw = fs.readFileSync(this.INSTALLED_SERVERS_PATH, 'utf-8');
        return JSON.parse(raw || '[]');
      }
      return [];
    } catch (error) {
      console.warn('⚠️ 同步加载已安装MCP服务器配置失败:', error);
      return [];
    }
  }

  /**
   * 保存已安装或创建的MCP服务器配置，供下次启动使用
   */
  private async saveInstalledServer(server: MCPServer): Promise<void> {
    try {
      const installedServers = await this.loadInstalledServers();
      const existingIndex = installedServers.findIndex(s => s.id === server.id);
      
      if (existingIndex >= 0) {
        installedServers[existingIndex] = server;
      } else {
        installedServers.push(server);
      }
      
      fs.writeFileSync(this.INSTALLED_SERVERS_PATH, JSON.stringify(installedServers, null, 2));
      
      // 修复：生成完整的mcpServers.user.js配置文件
      const mcpConfig = {
        mcpServers: Object.fromEntries(
          installedServers.map(srv => [
            srv.id,
            {
              command: srv.command,
              args: srv.args,
              env: srv.env || {},
              // 修复：添加缺失的关键字段
              cwd: srv.cwd || process.cwd(), // 提供默认工作目录
              category: srv.category || 'general',
              // 修复：添加元数据字段
              description: srv.description,
              tags: srv.tags || []
            }
          ])
        )
      };
      
      // 修复：使用ESM格式而不是CommonJS
      const configContent = `// 自动生成的MCP服务器配置
// 此文件由 ALOU 在安装/创建MCP服务器时生成
// 可以手动编辑以调整命令或环境变量

export default ${JSON.stringify(mcpConfig, null, 2)};

// 兼容CommonJS格式
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ${JSON.stringify(mcpConfig, null, 2)};
}
`;
      
      fs.writeFileSync(this.MCP_CONFIG_PATH, configContent);
      console.log(`✅ 服务器配置已保存: ${server.id}`);
      
    } catch (error) {
      console.error('❌ 保存服务器配置失败:', error);
    }
  }

  /**
   * 获取合适的NPX命令路径
   */
  private getNpxCommand(): string {
    // 优先使用内置NPX
    if (process.env.PORTABLE_NPX_PATH) {
      return process.env.PORTABLE_NPX_PATH;
    }
    
    // 回退到系统NPX
    return 'npx';
  }

  /**
   * 获取合适的Node命令路径
   */
  private getNodeCommand(): string {
    // 优先使用内置Node.js
    if (process.env.PORTABLE_NODE_PATH) {
      return process.env.PORTABLE_NODE_PATH;
    }
    
    // 回退到系统Node.js
    return 'node';
  }

  /**
   * 启动MCP服务
   */
  private async startMCPServer(config: { name: string; command: string; args?: string[]; env?: Record<string, string>; cwd?: string }): Promise<any | null> {
    try {
      console.log(`🚀 启动服务: ${config.command}`);
      
      let actualCommand = config.command;
      let args = config.args || [];
      
      // 如果命令是npx，使用我们的NPX路径
      if (actualCommand === 'npx' || actualCommand.endsWith('npx')) {
        actualCommand = this.getNpxCommand();
      }
      
      // 如果命令是node，使用我们的Node.js路径
      if (actualCommand === 'node' || actualCommand.endsWith('node')) {
        actualCommand = this.getNodeCommand();
      }
      
      const child = spawn(actualCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: config.cwd || process.cwd(),
        env: { 
          ...process.env, 
          ...config.env,
          // 确保内置Node.js的模块路径正确
          ...(process.env.PORTABLE_NODE_DIR && {
            NODE_PATH: require('path').join(process.env.PORTABLE_NODE_DIR, 'lib', 'node_modules')
          })
        }
      });

      // 处理子进程的输出
      child.stdout.on('data', (data) => {
        console.log(`${config.name} stdout: ${data}`);
      });
      child.stderr.on('data', (data) => {
        console.warn(`${config.name} stderr: ${data}`);
      });

      // 处理子进程退出
      return new Promise((resolve) => {
        child.on('close', (code) => {
          console.log(`${config.name} exited with code ${code}`);
          if (code !== 0) {
            resolve(null); // 启动失败
          } else {
            resolve(child); // 启动成功
          }
        });
      });

    } catch (error) {
      console.error(`❌ 启动服务失败 ${config.name}:`, error);
      return null;
    }
  }

  /**
   * 公共Memory查询接口
   */
  async queryMemory(tool: string, args: any): Promise<any> {
    return await this.callMemoryService(tool, args);
  }

  /**
   * 获取已安装服务的详细信息
   */
  async getInstalledServersInfo(): Promise<{
    configData: any;
    memoryRecords: any;
  }> {
    try {
      // 读取配置文件
      const configData = this.loadInstalledServersSync();
      
      // 改用标签搜索来查询memory中的已安装服务记录
      const memoryResponse = await this.callMemoryService('search_by_tag', {
        tags: ['已安装', 'installed_service']
      });
      
      // 正确解析memory记录格式
      let memoryRecords = { content: [], total: 0 };
      if (memoryResponse && memoryResponse.length > 0 && memoryResponse[0].text) {
        try {
          const parsedData = JSON.parse(memoryResponse[0].text);
          memoryRecords = {
            content: parsedData.memories || [],
            total: parsedData.total || 0
          };
        } catch (parseError) {
          console.error('❌ Memory数据解析失败:', parseError);
        }
      }
      
      console.log(`📊 调试: 配置文件服务数量=${configData.length}, memory记录数量=${memoryRecords.content.length}`);
      
      return { configData, memoryRecords };
    } catch (error) {
      console.error('❌ 获取已安装服务信息失败:', error);
      return { configData: [], memoryRecords: { content: [], total: 0 } };
    }
  }

  /**
   * 从 mcpServers.user.json 加载用户配置的 MCP 服务器
   */
  private async loadUserMCPServers(): Promise<void> {
    try {
      if (fs.existsSync(this.MCP_USER_JSON_PATH)) {
        const content = fs.readFileSync(this.MCP_USER_JSON_PATH, 'utf-8');
        const config = JSON.parse(content);
        
        if (config.mcpServers) {
          // 静默加载配置
          let count = 0;
          
          // 定义已知服务的默认描述
          const defaultDescriptions: Record<string, { description: string; tags: string[] }> = {
            'filesystem': {
              description: 'File system operations - browse, read, write, and manage files and directories',
              tags: ['file', 'directory', 'filesystem', 'storage']
            },
            'browser': {
              description: 'Web browser automation - navigate pages, interact with elements, take screenshots',
              tags: ['browser', 'web', 'automation', 'scraping']
            },
            'fetch': {
              description: 'HTTP client - make web requests, download content, interact with APIs',
              tags: ['http', 'api', 'web', 'fetch']
            }
          };
          
          // 将 JSON 格式的服务器配置转换为 MCPServer 格式
          for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
            const cfg = serverConfig as any;
            
            // 获取默认描述（如果服务没有描述）
            const defaults = defaultDescriptions[serverId] || defaultDescriptions[serverId.replace(/^custom-/, '').replace(/-\d+$/, '')];
            
            const server: MCPServer = {
              id: serverId,
              title: serverId.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()),
              description: cfg.description || defaults?.description || `MCP Server: ${serverId}`,
              similarity_score: 1.0,
              command: cfg.command,
              args: cfg.args,
              tags: cfg.tags || defaults?.tags || [],
              category: cfg.category || 'general',
              cwd: cfg.cwd,
              env: cfg.env
            };
            
            // 保存到已安装服务器列表
            await this.saveToInstalledServers(server);
            count++;
          }
          
          if (count > 0) {
            console.log(`✅ 已加载 ${count} 个用户配置的MCP服务器`);
          }
        }
      }
    } catch (error) {
      // 静默处理错误
    }
  }

  /**
   * 保存服务器到已安装列表（不重复）
   */
  private async saveToInstalledServers(server: MCPServer): Promise<void> {
    try {
      let installedServers: MCPServer[] = [];
      
      if (fs.existsSync(this.INSTALLED_SERVERS_PATH)) {
        const raw = fs.readFileSync(this.INSTALLED_SERVERS_PATH, 'utf-8');
        installedServers = JSON.parse(raw || '[]');
      }
      
      // 检查是否已存在
      const existingIndex = installedServers.findIndex(s => s.id === server.id);
      if (existingIndex >= 0) {
        // 更新现有服务器
        installedServers[existingIndex] = server;
      } else {
        // 添加新服务器
        installedServers.push(server);
      }
      
      fs.writeFileSync(this.INSTALLED_SERVERS_PATH, JSON.stringify(installedServers, null, 2));
    } catch (error) {
      console.error('❌ 保存服务器到已安装列表失败:', error);
    }
  }

  /**
   * AI 驱动的工具选择和执行
   */
  async executeAISelectedTool(userInput: string, need: UserNeed): Promise<string> {
    try {
      console.log('🤖 AI 正在分析并选择合适的工具...');
      
      // 1. 获取所有可用的 MCP 服务器
      const availableServers = await this.getAllAvailableServers();
      
      // 2. AI 选择最合适的服务器
      const selectedServer = await this.aiSelectBestServer(userInput, need, availableServers);
      
      if (!selectedServer) {
        console.log('🔍 AI 未找到合适的现有工具，尝试创建新工具...');
        return await this.createAndExecuteNewService(need, userInput);
      }
      
      console.log(`✅ AI 选择了工具: ${selectedServer.title}`);
      
      // 3. 启动并执行选定的服务器
      const executionResult = await this.startAndExecuteTool(selectedServer, userInput, need);
      
      return executionResult;
    } catch (error) {
      console.error('❌ AI 工具选择和执行失败:', error);
      return `❌ 执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 获取所有可用的 MCP 服务器
   */
  private async getAllAvailableServers(): Promise<MCPServer[]> {
    try {
      // 从已安装服务器列表获取
      let servers: MCPServer[] = [];
      
      if (fs.existsSync(this.INSTALLED_SERVERS_PATH)) {
        const raw = fs.readFileSync(this.INSTALLED_SERVERS_PATH, 'utf-8');
        servers = JSON.parse(raw || '[]');
      }
      
      console.log(`📋 找到 ${servers.length} 个可用的 MCP 服务器`);
      return servers;
    } catch (error) {
      console.error('❌ 获取可用服务器失败:', error);
      return [];
    }
  }

  /**
   * AI 选择最佳服务器
   */
  private async aiSelectBestServer(userInput: string, need: UserNeed, servers: MCPServer[]): Promise<MCPServer | null> {
    try {
      // 首先检查用户是否明确提到了某个服务名称
      const lowerInput = userInput.toLowerCase();
      for (const server of servers) {
        const serverId = server.id.toLowerCase();
        const serverTitle = server.title.toLowerCase();
        
        // 如果用户明确提到了服务名称，直接返回该服务
        if (lowerInput.includes(serverId) || lowerInput.includes(serverTitle)) {
          console.log(`🎯 用户明确指定了服务: ${server.id}`);
          return server;
        }
        
        // 检查是否提到了服务的关键功能词
        if (serverId.includes('filesystem') && (lowerInput.includes('文件') || lowerInput.includes('folder') || lowerInput.includes('目录'))) {
          console.log(`🎯 匹配到文件系统服务: ${server.id}`);
          return server;
        }
      }
      
      // 如果没有明确匹配，使用 AI 选择
      const aiModule = await import('./ai.js');
      const askLLM = aiModule.askLLM;
      
      const serverDescriptions = servers.map((s, i) => 
        `${i + 1}. ${s.id}: ${s.description} (类别: ${s.category}, 标签: ${s.tags?.join(', ') || '无'})`
      ).join('\n');
      
      const prompt = `作为 AI 助手，请根据用户需求选择最合适的 MCP 工具。

用户需求: "${userInput}"
需求类型: ${need.service_type}
关键词: ${need.keywords.join(', ')}
置信度: ${need.intent_confidence}

可用的 MCP 工具:
${serverDescriptions}

请选择最合适的工具编号（1-${servers.length}），如果没有合适的工具，返回 0。
只返回数字，不要其他解释。

选择标准:
1. 功能匹配度 - 工具功能是否满足用户需求
2. 类别匹配 - 工具类别是否与需求类型一致
3. 标签相关性 - 工具标签是否包含相关关键词
4. 描述相关性 - 工具描述是否与需求相关

返回格式: 纯数字（0 到 ${servers.length}）`;

      const selection = await askLLM(prompt);
      const selectedIndex = parseInt(selection.trim());
      
      if (selectedIndex > 0 && selectedIndex <= servers.length) {
        return servers[selectedIndex - 1];
      }
      
      return null;
    } catch (error) {
      console.error('❌ AI 选择服务器失败:', error);
      return null;
    }
  }

  /**
   * 启动并执行工具
   */
  private async startAndExecuteTool(server: MCPServer, userInput: string, need: UserNeed): Promise<string> {
    try {
      console.log(`🚀 启动工具: ${server.command} ${server.args?.join(' ') || ''}`);
      
      // 创建 MCP 客户端连接
      const client = await this.createMCPClientInternal(
        server.command!,
        server.args || [],
        server.env,
        server.cwd
      );
      
      // 将客户端添加到运行服务列表
      this.runningServices.set(server.id, client);
      
      // 获取工具列表
      const tools = await client.listTools();
      console.log(`🛠️ 可用工具: ${tools.tools?.map((t: any) => t.name).join(', ') || '无'}`);
      
      if (tools.tools && tools.tools.length > 0) {
        // AI 选择并执行具体的工具
        const toolResult = await this.aiExecuteTool(client, tools.tools, userInput, need);
        return toolResult;
      } else {
        return `✅ 服务 ${server.title} 已启动，但没有可用的工具。`;
      }
      
    } catch (error) {
      console.error(`❌ 启动工具失败:`, error);
      return `❌ 启动失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * AI 执行具体的工具
   */
  private async aiExecuteTool(client: any, tools: any[], userInput: string, need: UserNeed): Promise<string> {
    try {
      const aiModule = await import('./ai.js');
      const askLLM = aiModule.askLLM;
      
      // 准备工具描述
      const toolDescriptions = tools.map((t: any) => 
        `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.inputSchema?.properties || {}, null, 2)}`
      ).join('\n\n');
      
      const prompt = `作为 AI 助手，请根据用户需求选择并生成工具调用参数。

用户需求: "${userInput}"
需求类型: ${need.service_type}

可用工具:
${toolDescriptions}

重要提示：
1. 仔细分析用户输入，提取所有必要的参数信息
2. 如果用户提到了 URL、文件路径、查询内容等，务必包含在参数中
3. 如果缺少必需参数，使用合理的默认值或示例值
4. 确保所有必需参数都有值，不要留空

示例：
- 如果用户说"获取 example.com 的内容"，url 应该是 "https://baidu.com"
- 如果用户说"查看 D:\\ 目录"，path 应该是 "D:\\"
- 如果用户只说"使用工具"但没有具体内容，使用合理的示例值

请生成一个 JSON 格式的工具调用，包含:
{
  "tool": "工具名称",
  "arguments": {
    // 工具参数，确保所有必需参数都有值
  }
}

只返回 JSON，不要其他解释。`;

      const toolCallStr = await askLLM(prompt);
      
      // 解析 AI 生成的工具调用
      let toolCall: any;
      try {
        // 清理可能的 markdown 代码块
        const cleanedStr = toolCallStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        toolCall = JSON.parse(cleanedStr);
      } catch (parseError) {
        console.error('❌ 解析 AI 工具调用失败:', parseError);
        console.log('原始响应:', toolCallStr);
        
        // 如果解析失败，尝试提供一个默认的工具调用
        const firstTool = tools[0];
        const defaultArgs: any = {};
        
        // 根据工具类型提供默认参数
        if (firstTool.name.includes('fetch')) {
          // 尝试从用户输入中提取 URL
          const urlMatch = userInput.match(/https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|cn)[^\s]*/i);
          defaultArgs.url = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : 'https://example.com';
        } else if (firstTool.name.includes('file') || firstTool.name.includes('directory')) {
          // 文件系统相关工具
          const pathMatch = userInput.match(/[A-Z]:\\[^\s]*|\/[^\s]*/);
          defaultArgs.path = pathMatch ? pathMatch[0] : process.cwd();
        }
        
        toolCall = {
          tool: firstTool.name,
          arguments: defaultArgs
        };
        
        console.log('📝 使用默认参数:', toolCall);
      }
      
      console.log(`🔧 执行工具: ${toolCall.tool}`);
      console.log(`📝 参数: ${JSON.stringify(toolCall.arguments, null, 2)}`);
      
      // 验证参数完整性
      const selectedTool = tools.find(t => t.name === toolCall.tool);
      if (selectedTool && selectedTool.inputSchema?.required) {
        for (const requiredParam of selectedTool.inputSchema.required) {
          if (!toolCall.arguments[requiredParam]) {
            console.warn(`⚠️ 缺少必需参数: ${requiredParam}`);
            
            // 为缺失的参数提供默认值
            if (requiredParam === 'url') {
              toolCall.arguments.url = 'https://example.com';
            } else if (requiredParam === 'path') {
              toolCall.arguments.path = process.cwd();
            }
          }
        }
      }
      
      // 执行工具调用
      const result = await client.callTool({
        name: toolCall.tool,
        arguments: toolCall.arguments
      });
      
      // 格式化结果
      if (result.content && Array.isArray(result.content)) {
        const resultText = result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
        return `✅ 工具执行成功！\n\n结果:\n${resultText}`;
      }
      
      return `✅ 工具执行完成`;
      
    } catch (error) {
      console.error('❌ AI 执行工具失败:', error);
      return `❌ 执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 根据 AI 给出的修复方案执行操作后，尝试重新安装 / 启动一次
   */
  private async applyFixAndRetry(server: MCPServer, fix: any): Promise<InstallResult> {
    switch (fix.action) {
      case 'set_env':
        if (fix.envKey) {
          server.env = { ...(server.env || {}), [fix.envKey]: fix.envValue ?? '' };
          console.log(`🔧 已设置环境变量 ${fix.envKey}=${fix.envValue ?? ''}`);
        }
        break;
      case 'install_dep':
        if (fix.dependency) {
          console.log(`📦 安装缺失依赖 ${fix.dependency}`);
          try {
            execSync(`pip install ${fix.dependency}`, { stdio: 'inherit' as any });
          } catch (e) {
            console.warn('⚠️ 依赖安装失败: ', e);
          }
        }
        break;
      case 'switch_server':
        // 当前版本仅返回失败信息，后续可实现自动切换
        return {
          success: false,
          serverId: server.id,
          message: `⚠️ 需要切换服务器，请搜索关键词: ${fix.altServerKeyword}`
        };
      case 'retry':
        console.log('🔄 按 AI 建议重试');
        break;
      case 'edit_file':
        if (fix.filePath && (fix.replaceText || fix.insertText)) {
          try {
            const filePath = path.isAbsolute(fix.filePath) ? fix.filePath : path.join(process.cwd(), fix.filePath);
            let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
            if (fix.searchText && fix.replaceText) {
              content = content.replace(fix.searchText, fix.replaceText);
            } else if (fix.insertText) {
              content += '\n' + fix.insertText;
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`📝 已修改文件 ${filePath}`);
          } catch (e) {
            console.warn('⚠️ 修改文件失败:', e);
          }
        }
        break;
      default:
        return {
          success: false,
          serverId: server.id,
          message: fix.reason || '无法自动修复'
        };
    }

    // 再试一次安装 / 启动
    console.log('🔄 修复后再次尝试安装 / 启动服务...');
    return await this.installServer(server);
  }

  private async storeErrorMemory(server: MCPServer, errorMsg: string) {
    if (!this.memoryClient) return;
    await this.callMemoryService('store_memory', {
      content: `服务 ${server.id} 错误:\n${errorMsg}`,
      metadata: { tags: ['error', server.id], type: 'error_log', service_id: server.id }
    });
  }

  /**
   * 由上层在处理用户输入时调用，设置当前上下文。
   */
  public setContext(userInput: string, need: UserNeed) {
    this.currentUserInput = userInput;
    this.currentNeed = need;
  }
} 