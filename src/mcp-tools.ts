import { spawn, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { askLLM } from './llm.js';
import { callMCPCompass, callMCPInstaller, callMCPCreate } from './mcp-client.js';

// MCP 服务搜索结果接口
export interface MCPServer {
  id: string;
  title: string;
  description: string;
  github_url: string;
  similarity_score: number;
}

// 检查 MCP 工具是否可用
async function checkMCPTool(toolName: string): Promise<boolean> {
  try {
    execSync(`npx -y ${toolName} --version`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// MCP Compass - 搜索现有服务
export async function searchMCPServers(query: string): Promise<MCPServer[]> {
  console.log(`🔍 使用 MCP Compass 搜索服务: ${query}`);
  
  // 首先尝试调用真实的 MCP Compass 服务
  const compassResult = await callMCPCompass(query);
  if (compassResult && compassResult.content) {
    // 解析 MCP Compass 返回的结果
    const servers: MCPServer[] = [];
    
    // MCP Compass 可能返回的是文本内容，需要解析
    if (Array.isArray(compassResult.content)) {
        
        for (const item of compassResult.content) {
          if (item.type === 'text' && item.text) {
            // 尝试解析 JSON 格式的服务列表
            try {
              const parsed = JSON.parse(item.text);
              if (Array.isArray(parsed)) {
                const mappedServers = parsed.map((server: any) => ({
                  id: server.id || server.name,
                  title: server.title || server.name,
                  description: server.description || '',
                  github_url: server.github_url || server.url || '',
                  similarity_score: server.similarity_score || server.score || 0.5
                }));
                
                console.log('✅ MCP Compass 返回了', mappedServers.length, '个服务');
                return mappedServers;
              }
            } catch (e) {
              // 如果不是 JSON，尝试解析文本格式
              console.log('📝 解析 MCP Compass 文本响应...');
              
              // 解析文本格式的服务信息
              const lines = item.text.split('\n');
              let currentServer: any = {};
              
              for (const line of lines) {
                if (line.startsWith('Title:')) {
                  if (currentServer.title) {
                    // 保存前一个服务
                    servers.push({
                      id: currentServer.title.toLowerCase().replace(/\s+/g, '-'),
                      title: currentServer.title,
                      description: currentServer.description || '',
                      github_url: currentServer.github_url || '',
                      similarity_score: 0.5 // 默认分数
                    });
                  }
                  currentServer = { title: line.replace('Title:', '').trim() };
                } else if (line.startsWith('Description:')) {
                  currentServer.description = line.replace('Description:', '').trim();
                } else if (line.startsWith('GitHub URL:')) {
                  currentServer.github_url = line.replace('GitHub URL:', '').trim();
                } else if (line.startsWith('Similarity:')) {
                  const score = parseFloat(line.replace('Similarity:', '').replace('%', '').trim());
                  if (!isNaN(score)) {
                    currentServer.similarity_score = score / 100;
                  }
                }
              }
              
              // 保存最后一个服务
              if (currentServer.title) {
                servers.push({
                  id: currentServer.title.toLowerCase().replace(/\s+/g, '-'),
                  title: currentServer.title,
                  description: currentServer.description || '',
                  github_url: currentServer.github_url || '',
                  similarity_score: currentServer.similarity_score || 0.5
                });
              }
            }
          }
        }
        
        if (servers.length > 0) {
          console.log('✅ MCP Compass 返回了', servers.length, '个服务（文本格式）');
          
          // 处理服务信息，尝试推断 npm 包名
          const processedServers = servers.map(server => {
            // 如果是官方 modelcontextprotocol 仓库的服务
            if (server.github_url && server.github_url.includes('github.com/modelcontextprotocol/servers')) {
              // 从 GitHub URL 提取服务名
              const match = server.github_url.match(/\/src\/([^\/]+)$/);
              if (match) {
                return {
                  ...server,
                  title: `@modelcontextprotocol/server-${match[1]}`,
                  id: `server-${match[1]}`
                };
              }
            }
            // 如果标题看起来像 GitHub 项目名，尝试标准化
            else if (!server.title.includes('@') && !server.title.includes('/')) {
              // 保持原样，但标记为可能需要手动安装
              return {
                ...server,
                description: `${server.description} (可能需要从 GitHub 克隆安装)`
              };
            }
            
            return server;
          });
          
          return processedServers;
        }
      }
    }
  
  // 备用方案：使用预定义的服务列表 + LLM 智能匹配
  const knownServers: MCPServer[] = [
    {
      id: 'server-browser',
      title: '@modelcontextprotocol/server-browser',
      description: 'Browser automation and web scraping MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: 0
    },
    {
      id: 'server-filesystem',
      title: '@modelcontextprotocol/server-filesystem',
      description: 'File system operations MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: 0
    },
    {
      id: 'server-fetch',
      title: '@modelcontextprotocol/server-fetch',
      description: 'HTTP fetch operations MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: 0
    },
    {
      id: 'server-github',
      title: '@modelcontextprotocol/server-github',
      description: 'GitHub API integration MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: 0
    },
    {
      id: 'server-memory',
      title: '@modelcontextprotocol/server-memory',
      description: 'Memory and knowledge management MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: 0
    }
  ];
  
  // 使用 LLM 计算相似度
  const prompt = `
给定用户查询："${query}"
请为以下每个 MCP 服务计算相关性分数（0-1）：
${knownServers.map(s => `- ${s.title}: ${s.description}`).join('\n')}

返回 JSON 格式：
[{"title": "服务名", "score": 0.9}, ...]
只返回 JSON，不要其他内容。
`;
  
  try {
    const result = await askLLM(prompt);
    console.log('🤖 LLM 返回:', result);
    
    // 清理 LLM 返回的内容，移除可能的 markdown 标记
    let cleanedResult = result.trim();
    
    // 移除 markdown 代码块标记
    cleanedResult = cleanedResult.replace(/^```\w*\n?/gm, '').replace(/```$/gm, '');
    
    // 如果仍然包含 json 标记，再次清理
    if (cleanedResult.includes('```json')) {
      cleanedResult = cleanedResult.substring(
        cleanedResult.indexOf('['),
        cleanedResult.lastIndexOf(']') + 1
      );
    }
    
    const scores = JSON.parse(cleanedResult);
    
    // 更新相似度分数
    knownServers.forEach(server => {
      const scoreItem = scores.find((s: any) => s.title === server.title);
      if (scoreItem) {
        server.similarity_score = scoreItem.score;
      }
    });
  } catch (error) {
    console.log('⚠️ LLM 相似度计算失败，使用关键词匹配:', error);
    // 如果 LLM 失败，使用简单的关键词匹配
    knownServers.forEach(server => {
      const keywords = query.toLowerCase().split(' ');
      const text = `${server.title} ${server.description}`.toLowerCase();
      const matchCount = keywords.filter(k => text.includes(k)).length;
      server.similarity_score = matchCount > 0 ? matchCount / keywords.length : 0;
      
      // 特殊处理：如果服务名称或描述包含查询的核心词，提高分数
      if (text.includes('filesystem') && query.toLowerCase().includes('file')) {
        server.similarity_score = Math.max(server.similarity_score, 0.8);
      }
      if (text.includes('browser') && query.toLowerCase().includes('browser')) {
        server.similarity_score = Math.max(server.similarity_score, 0.8);
      }
      if (text.includes('github') && query.toLowerCase().includes('github')) {
        server.similarity_score = Math.max(server.similarity_score, 0.8);
      }
    });
  }
  
  // 打印调试信息
  console.log('📊 相似度分数:', knownServers.map(s => ({ title: s.title, score: s.similarity_score })));
  
  // 根据相似度排序并返回
  return knownServers
    .filter(server => server.similarity_score > 0.3)
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

// MCP Installer - 安装现有服务
export async function installMCPServer(name: string): Promise<string> {
  console.log(`📦 使用 MCP Installer 安装服务: ${name}`);
  
  // 首先尝试调用真实的 MCP Installer 服务
  try {
    const installerResult = await callMCPInstaller(name);
    if (installerResult && installerResult.content) {
      // 解析安装结果
      if (Array.isArray(installerResult.content)) {
        for (const item of installerResult.content) {
          if (item.type === 'text' && item.text) {
            console.log('✅ MCP Installer:', item.text);
            
            // 检查是否安装成功
            if (item.text.includes('success') || item.text.includes('installed')) {
              // MCP Installer 已经处理了安装，但我们仍需要创建本地配置
              console.log('📝 创建本地配置文件...');
              const serverName = name.split('/').pop() || name;
              const serverDir = path.join(process.cwd(), 'mcp-services', serverName);
              await fs.mkdir(serverDir, { recursive: true });
              
              // 创建符合 MCP 官方格式的配置文件
              const isWindows = process.platform === 'win32';
              const mcpConfig = {
                [serverName]: {
                  command: isWindows ? 'cmd' : 'npx',
                  args: isWindows 
                    ? ['/c', 'npx', '-y', name]
                    : ['-y', name]
                }
              };
              
              const configPath = path.join(serverDir, 'mcp-config.json');
              await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2));
              
              return `✅ 成功安装 ${name} 服务\n${item.text}\n📄 配置文件: ${configPath}`;
              
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('⚠️ MCP Installer 调用失败，使用备用安装方案');
  }
  
  // 备用方案：手动安装并创建配置文件
  console.log('📝 使用备用方案安装服务...');
  
  // 创建服务目录
  const serverName = name.split('/').pop() || name;
  const serverDir = path.join(process.cwd(), 'mcp-services', serverName);
  await fs.mkdir(serverDir, { recursive: true });
  
  // 首先尝试使用 npx 确保包可以被下载和缓存
  console.log(`📥 预下载 ${name} 包...`);
  try {
    // 使用 npx 下载并缓存包
    await new Promise<void>((resolve, reject) => {
      const preloadProcess = spawn('npx', ['-y', name, '--version'], {
        cwd: serverDir,
        shell: true,
        stdio: 'pipe'
      });
      
      let output = '';
      preloadProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      preloadProcess.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      preloadProcess.on('close', (code) => {
        if (code === 0 || output.includes('version') || output.includes('Version')) {
          console.log('✅ 包预下载成功');
          resolve();
        } else {
          // 即使失败也继续，可能包不支持 --version 参数
          console.log('⚠️ 包预下载可能失败，但继续创建配置');
          resolve();
        }
      });
      
      preloadProcess.on('error', () => {
        console.log('⚠️ 预下载失败，但继续创建配置');
        resolve();
      });
    });
  } catch (error) {
    console.log('⚠️ 预下载过程出错，但继续创建配置');
  }
  
  // 创建 package.json（可选，用于记录）
  const packageJson = {
    name: serverName,
    version: '1.0.0',
    description: `MCP service configuration for ${name}`,
    scripts: {
      start: `npx -y ${name}`
    }
  };
  
  await fs.writeFile(
    path.join(serverDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // 创建符合 MCP 官方格式的配置文件
  const isWindows = process.platform === 'win32';
  const mcpConfig = {
    [serverName]: {
      command: isWindows ? 'cmd' : 'npx',
      args: isWindows 
        ? ['/c', 'npx', '-y', name]
        : ['-y', name]
    }
  };
  
  const configPath = path.join(serverDir, 'mcp-config.json');
  await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2));
  
  return `✅ 成功安装 ${name} 服务
📄 配置文件: ${configPath}
💡 提示: 服务将在首次使用时自动下载并运行`;
}

// MCP Create - 创建新服务
export async function createMCPServer(
  language: 'typescript' | 'python',
  code: string,
  serverName: string
): Promise<{ serverId: string; configPath: string }> {
  console.log(`🛠️ 创建新的 MCP 服务: ${serverName}`);
  
  // 创建服务目录
  const serverDir = path.join(process.cwd(), 'mcp-services', serverName);
  await fs.mkdir(serverDir, { recursive: true });
  
  // 首先尝试调用真实的 MCP Create 服务
  try {
    const createResult = await callMCPCreate(language, code);
    if (createResult && createResult.content) {
      // 解析创建结果
      if (Array.isArray(createResult.content)) {
        for (const item of createResult.content) {
          if (item.type === 'text' && item.text) {
            console.log('✅ MCP Create:', item.text);
            
            // 检查是否创建成功，可能返回了服务 ID 和配置路径
            try {
              const parsed = JSON.parse(item.text);
              if (parsed.serverId && parsed.configPath) {
                return {
                  serverId: parsed.serverId,
                  configPath: parsed.configPath
                };
              }
            } catch (e) {
              // 不是 JSON 格式，继续处理
            }
          }
        }
      }
      
      // 如果 MCP Create 成功但没有返回预期格式，仍然算成功
      console.log('✅ MCP Create 执行成功，检查生成的文件...');
    }
  } catch (error) {
    console.log('⚠️ MCP Create 调用失败，使用备用创建方案');
  }
  
  // 检查是否已经创建了必要的文件
  const packageJsonExists = await fs.access(path.join(serverDir, 'package.json')).then(() => true).catch(() => false);
  
  if (!packageJsonExists) {
    // 根据语言创建不同的文件
    if (language === 'typescript') {
      // 创建 TypeScript 服务文件
      const serverFile = path.join(serverDir, 'index.ts');
      await fs.writeFile(serverFile, code);
      
      // 创建 package.json
      const packageJson = {
        name: serverName,
        version: '1.0.0',
        main: 'dist/index.js',
        scripts: {
          build: 'tsc',
          start: 'node dist/index.js',
          dev: 'tsx index.ts'
        },
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.0.0',
          'zod': '^3.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          '@types/node': '^20.0.0',
          'tsx': '^4.0.0'
        }
      };
      
      await fs.writeFile(
        path.join(serverDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // 创建 tsconfig.json
      const tsConfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'Node16',
          moduleResolution: 'Node16',
          outDir: './dist',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true
        }
      };
      
      await fs.writeFile(
        path.join(serverDir, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2)
      );
    }
  }
  
  // 创建符合 MCP 官方格式的配置文件
  const isWindows = process.platform === 'win32';
  let command: string;
  let args: string[];
  
  if (language === 'typescript') {
    if (isWindows) {
      command = 'cmd';
      args = ['/c', 'npx', 'tsx', 'index.ts'];
    } else {
      command = 'npx';
      args = ['tsx', 'index.ts'];
    }
  } else {
    command = 'python';
    args = ['index.py'];
  }
  
  const mcpConfig = {
    [serverName]: {
      command,
      args
    }
  };
  
  const configPath = path.join(serverDir, 'mcp-config.json');
  await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2));
  
  return {
    serverId: serverName,
    configPath: configPath
  };
}

// 安装服务依赖
export async function installDependencies(serverPath: string): Promise<void> {
  console.log(`📥 安装依赖: ${serverPath}`);
  
  return new Promise((resolve, reject) => {
    const npmInstall = spawn('npm', ['install'], {
      cwd: serverPath,
      shell: true,
      stdio: 'inherit'
    });

    npmInstall.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`依赖安装失败，退出码: ${code}`));
      }
    });

    npmInstall.on('error', (err) => {
      reject(err);
    });
  });
}

// 启动 MCP 服务
export async function startMCPServer(configPath: string): Promise<void> {
  const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  
  console.log(`🚀 启动 MCP 服务: ${config.name}`);
  
  const serverProcess = spawn(config.command, [], {
    cwd: config.workingDirectory,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...config.env }
  });
  
  serverProcess.on('error', (err) => {
    console.error(`服务启动失败: ${err.message}`);
  });
} 