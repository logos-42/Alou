#!/usr/bin/env node
"use strict";
// MCP Host CLI - 最简版本
// 只使用 Node.js 内置模块，便于打包
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const https = __importStar(require("https"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const isPkg = typeof process.pkg !== 'undefined';
const execDir = isPkg ? path.dirname(process.execPath) : process.cwd();
// 简单的 HTTPS 请求函数
function httpsRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}
// 创建简单的 MCP 服务
async function createService(name, description) {
    const serverDir = path.join(execDir, 'mcp-services', name);
    // 创建目录
    fs.mkdirSync(serverDir, { recursive: true });
    // 生成服务代码
    const serviceCode = `// ${name} - MCP Service
// ${description}

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const server = new Server({
  name: '${name}',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

// 工具列表
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [{
      name: 'example_tool',
      description: '${description}',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        }
      }
    }]
  };
});

// 工具调用
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'example_tool') {
    return {
      content: [{
        type: 'text',
        text: \`Result: \${request.params.arguments.query}\`
      }]
    };
  }
  throw new Error('Tool not found');
});

// 启动服务
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${name} MCP service started');
}

main().catch(console.error);
`;
    // 保存文件
    fs.writeFileSync(path.join(serverDir, 'index.js'), serviceCode);
    // 创建 package.json
    const packageJson = {
        name: name,
        version: "1.0.0",
        main: "index.js",
        dependencies: {
            "@modelcontextprotocol/sdk": "^1.13.2"
        }
    };
    fs.writeFileSync(path.join(serverDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    // 创建 MCP 配置
    const mcpConfig = {
        mcpServers: {
            [name]: {
                command: "node",
                args: [path.join(serverDir, 'index.js')],
                env: {}
            }
        }
    };
    fs.writeFileSync(path.join(serverDir, 'mcp-config.json'), JSON.stringify(mcpConfig, null, 2));
    return serverDir;
}
// 主函数
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(`
🤖 MCP Host CLI - 简单版

使用方法:
  mcp-host.exe "创建 [服务描述]"

示例:
  mcp-host.exe "创建一个天气查询服务"
  mcp-host.exe "创建翻译工具"
`);
        return;
    }
    const userInput = args.join(' ');
    console.log('👤 用户输入:', userInput);
    // 检查是否要创建服务
    if (userInput.includes('创建') || userInput.includes('新建')) {
        console.log('🛠️ 开始创建服务...');
        // 提取服务类型
        let serviceType = 'general';
        if (userInput.includes('天气'))
            serviceType = 'weather';
        else if (userInput.includes('翻译'))
            serviceType = 'translation';
        else if (userInput.includes('数据'))
            serviceType = 'database';
        const serviceName = `mcp-${serviceType}-${Date.now()}`;
        try {
            const serverDir = await createService(serviceName, userInput);
            console.log(`
✅ 服务创建成功！
📁 服务目录: ${serverDir}
📄 配置文件: ${path.join(serverDir, 'mcp-config.json')}

🔧 使用步骤:
1. cd ${serverDir}
2. npm install
3. 将 mcp-config.json 内容添加到 Cursor 配置
`);
        }
        catch (error) {
            console.error('❌ 创建失败:', error);
        }
    }
    else {
        console.log('💡 请使用 "创建" 关键词来创建新服务');
    }
}
// 启动
main().catch(error => {
    console.error('❌ 错误:', error);
    process.exit(1);
});
//# sourceMappingURL=simple-cli.js.map