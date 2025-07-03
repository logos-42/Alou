#!/usr/bin/env node
"use strict";
// MCP Host CLI - 独立版本
// 这是一个单文件版本，包含所有必要的功能
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const dotenv = __importStar(require("dotenv"));
// 处理 pkg 打包后的路径问题
const isPkg = typeof process.pkg !== 'undefined';
const execDir = isPkg ? path.dirname(process.execPath) : process.cwd();
// 加载环境变量
if (isPkg) {
    dotenv.config({ path: path.join(execDir, '.env') });
}
else {
    dotenv.config();
}
// 简化的 LLM 调用
async function askLLM(prompt) {
    const apiKey = process.env.LLM_API_KEY || 'sk-392a95fc7d2445f6b6c79c17725192d1';
    const apiUrl = process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
    const model = process.env.LLM_MODEL || 'deepseek-chat';
    try {
        const response = await axios_1.default.post(apiUrl, {
            model,
            messages: [
                { role: 'system', content: '你是一个 MCP 服务助手。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 30000
        });
        return response.data.choices[0].message.content;
    }
    catch (error) {
        console.error('❌ LLM 调用失败:', error);
        throw error;
    }
}
// 简化的 MCP 服务创建
async function createSimpleService(name, description) {
    const serverDir = path.join(execDir, 'mcp-services', name);
    await fs.mkdir(serverDir, { recursive: true });
    // 生成简单的服务代码
    const serviceCode = `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: '${name}',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'example_tool',
      description: '${description}',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query parameter' }
        },
        required: ['query']
      }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'example_tool') {
    return {
      content: [{
        type: 'text',
        text: \`Result for: \${request.params.arguments.query}\`
      }]
    };
  }
  throw new Error('Tool not found');
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`;
    // 保存文件
    await fs.writeFile(path.join(serverDir, 'index.js'), serviceCode);
    // 创建 package.json
    const packageJson = {
        name,
        version: "1.0.0",
        type: "module",
        main: "index.js",
        dependencies: {
            "@modelcontextprotocol/sdk": "^1.13.2"
        }
    };
    await fs.writeFile(path.join(serverDir, 'package.json'), JSON.stringify(packageJson, null, 2));
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
    await fs.writeFile(path.join(serverDir, 'mcp-config.json'), JSON.stringify(mcpConfig, null, 2));
    return serverDir;
}
// 主函数
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(`
🤖 MCP Host CLI - 独立版本

使用方法:
  mcp-host.exe "你的需求描述"

示例:
  mcp-host.exe "创建一个天气查询服务"
  mcp-host.exe "我需要一个翻译工具"
`);
        return;
    }
    const userInput = args.join(' ');
    console.log('👤 用户需求:', userInput);
    try {
        // 简单判断是否需要创建服务
        const needsCreate = /创建|新建|开发|编写|写一个|制作/.test(userInput);
        if (needsCreate) {
            console.log('🛠️ 开始创建新服务...');
            // 从用户输入提取服务类型
            let serviceType = 'general';
            if (/天气|weather/i.test(userInput))
                serviceType = 'weather';
            else if (/翻译|translate/i.test(userInput))
                serviceType = 'translation';
            else if (/数据库|database/i.test(userInput))
                serviceType = 'database';
            const serviceName = `mcp-${serviceType}-${Date.now()}`;
            const serverDir = await createSimpleService(serviceName, userInput);
            console.log(`
✅ 服务创建成功！
📁 服务目录: ${serverDir}
📄 配置文件: ${path.join(serverDir, 'mcp-config.json')}

🔧 使用方法:
1. 进入服务目录: cd ${serverDir}
2. 安装依赖: npm install
3. 将 mcp-config.json 的内容添加到 Cursor 的配置中
`);
        }
        else {
            console.log('💡 提示: 请使用 "创建" 或 "新建" 等关键词来创建新服务');
        }
    }
    catch (error) {
        console.error('❌ 错误:', error);
    }
}
// 启动
main().catch(error => {
    console.error('❌ 错误:', error);
    process.exit(1);
});
//# sourceMappingURL=standalone.js.map