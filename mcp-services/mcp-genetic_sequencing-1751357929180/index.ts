import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "genetic_sequencing-service",
  version: "1.0.0",
  type: "genetic_sequencing",
  keywords: ["基因测序", "操作终端"]
});

server.tool("dna_sequence_analyzer",
  { sequence: z.string().describe("DNA序列字符串") },
  async ({ sequence }) => ({
    content: [{ type: "text", text: `分析完成: ${sequence.substring(0, 10)}... (共${sequence.length}个碱基)` }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);