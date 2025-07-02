"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const server = new mcp_js_1.McpServer({
    name: "crypto-service",
    version: "1.0.0"
});
server.tool("query-ethereum-price", { currency: zod_1.z.string().describe("The currency to compare against, e.g. USD, EUR") }, async ({ currency }) => ({
    content: [{ type: "text", text: `Current Ethereum price in ${currency}: $3,500 (example value)` }]
}));
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
