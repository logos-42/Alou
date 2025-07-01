import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "crypto-service",
  version: "1.0.0"
});

server.tool("query-ethereum-price",
  { currency: z.string().describe("The currency to compare against, e.g. USD, EUR") },
  async ({ currency }) => ({
    content: [{ type: "text", text: `Current Ethereum price in ${currency}: $3,500 (example value)` }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);