import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// MCP 服务搜索结果接口
export interface MCPServer {
  id: string;
  title: string;
  description: string;
  github_url: string;
  similarity_score: number;
}

// MCP Compass - 搜索现有服务
export async function searchMCPServers(query: string): Promise<MCPServer[]> {
  // 这里模拟调用 mcp_mcp-compass_recommend-mcp-servers
  // 实际使用时需要通过 MCP 协议调用
  console.log(`🔍 搜索 MCP 服务: ${query}`);
  
  // 返回真实存在的 MCP 服务
  const knownServers: MCPServer[] = [
    {
      id: 'server-browser',
      title: '@modelcontextprotocol/server-browser',
      description: 'Browser automation and web scraping MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: query.includes('browser') || query.includes('web') ? 0.9 : 0.3
    },
    {
      id: 'server-filesystem',
      title: '@modelcontextprotocol/server-filesystem',
      description: 'File system operations MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: query.includes('file') || query.includes('文件') ? 0.9 : 0.3
    },
    {
      id: 'server-fetch',
      title: '@modelcontextprotocol/server-fetch',
      description: 'HTTP fetch operations MCP server',
      github_url: 'https://github.com/modelcontextprotocol/servers',
      similarity_score: query.includes('fetch') || query.includes('http') || query.includes('api') ? 0.9 : 0.3
    }
  ];
  
  // 根据相似度排序
  return knownServers
    .filter(server => server.similarity_score > 0.2)
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

// MCP Installer - 安装现有服务
export async function installMCPServer(name: string): Promise<string> {
  console.log(`📦 安装 MCP 服务: ${name}`);
  
  // 创建服务目录
  const serverName = name.split('/').pop() || name;
  const serverDir = path.join(process.cwd(), 'mcp-services', serverName);
  await fs.mkdir(serverDir, { recursive: true });
  
  // 创建 package.json
  const packageJson = {
    name: serverName,
    version: '1.0.0',
    scripts: {
      start: `npx -y ${name}`
    },
    dependencies: {}
  };
  
  await fs.writeFile(
    path.join(serverDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // 创建 MCP 配置文件
  const mcpConfig = {
    name: serverName,
    command: 'npx',
    args: ['-y', name],
    workingDirectory: serverDir,
    env: {}
  };
  
  const configPath = path.join(serverDir, 'mcp-config.json');
  await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2));
  
  return `✅ 成功配置 ${name} 服务\n📄 配置文件: ${configPath}`;
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
  
  // 创建 MCP 配置文件
  const mcpConfig = {
    name: serverName,
    command: language === 'typescript' ? 'npm run dev' : 'python index.py',
    workingDirectory: serverDir,
    env: {}
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