import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new Server({
  name: '健康管理-service',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// TODO: 实现 健康管理 相关的工具
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  // 实现你的工具逻辑
  return {
    content: [{
      type: 'text',
      text: `调用了工具 ${name}`
    }]
  };
});

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'example_tool',
        description: '示例工具',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    ]
  };
});

const transport = new StdioServerTransport();
server.connect(transport);