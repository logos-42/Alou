import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "task_management-service",
  version: "1.0.0"
});

server.tool("add_todo",
  { task: z.string().describe("待办事项内容") },
  async ({ task }) => ({
    content: [{ type: "text", text: `已添加待办事项: ${task}` }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);