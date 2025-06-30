import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";

// 创建服务器实例
const server = new Server({
  name: "{{SERVICE_NAME}}",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "{{TOOL_NAME}}",
      description: "{{TOOL_DESCRIPTION}}",
      inputSchema: {
        type: "object",
        properties: {
          message: { 
            type: "string",
            description: "输入消息"
          }
        },
        required: ["message"]
      }
    }]
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "{{TOOL_NAME}}") {
    const message = request.params.arguments?.message as string | undefined;
    if (!message) {
      throw new Error("缺少必需的参数: message");
    }
    
    // 这里实现具体的业务逻辑
    const result = `处理结果: ${message}`;
    
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  }
  
  throw new Error("未找到工具: " + request.params.name);
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP 服务已启动: {{SERVICE_NAME}}");
}

main().catch(console.error); 