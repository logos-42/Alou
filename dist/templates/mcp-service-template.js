"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
// 创建 MCP 服务器
const server = new mcp_js_1.McpServer({
    name: "{{SERVICE_NAME}}",
    version: "1.0.0"
});
// 添加工具
server.tool("{{TOOL_NAME}}", {
    message: zod_1.z.string().describe("输入消息")
}, async ({ message }) => ({
    content: [{
            type: "text",
            text: `{{TOOL_DESCRIPTION}}: ${message}`
        }]
}));
// 启动服务器
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("MCP 服务已启动: {{SERVICE_NAME}}");
}
main().catch(console.error);
//# sourceMappingURL=mcp-service-template.js.map