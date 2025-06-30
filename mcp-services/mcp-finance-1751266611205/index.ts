import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "finance-service",
  version: "1.0.0"
});

server.tool("queryStockMarketData",
  { 
    symbol: z.string().describe("股票代码，例如：AAPL"),
    market: z.string().describe("市场代码，例如：NASDAQ")
  },
  async ({ symbol, market }) => ({
    content: [{
      type: "text", 
      text: `查询结果：${symbol}在${market}的最新股价为$150.25`
    }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);