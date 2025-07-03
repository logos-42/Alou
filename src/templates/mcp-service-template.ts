// @ts-nocheck
/* eslint-disable @typescript-eslint/no-var-requires */
const { McpServer } = require("@modelcontextprotocol/sdk/dist/cjs/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/dist/cjs/server/stdio.js");
import { z } from "zod";

// 创建 MCP 服务器
const server = new McpServer({
  name: "{{SERVICE_NAME}}",
  version: "1.0.0"
});

// 添加工具
server.tool("{{TOOL_NAME}}",
  {
    message: z.string().describe("输入消息")
  },
  async ({ message }) => ({
    content: [{
      type: "text",
      text: `{{TOOL_DESCRIPTION}}: ${message}`
    }]
  })
);

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP 服务已启动: {{SERVICE_NAME}}");
}

main().catch(console.error); 