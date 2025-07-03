#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// CLI 入口文件，专门用于打包
const index_js_1 = require("./index");
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(`
🤖 MCP Host - 智能 MCP 服务管理器

使用方法:
  1. 直接运行: mcp-host "你的需求"
  2. Web 服务: mcp-host --server [端口]
  
示例:
  mcp-host "我需要一个天气查询服务"
  mcp-host "帮我创建一个翻译服务"
  mcp-host --server 3000

集成的 MCP 工具:
  🔍 搜索: MCP Compass
  📦 安装: MCP Installer  
  🛠️ 创建: MCP Create
`);
        return;
    }
    if (args[0] === '--server') {
        const port = args[1] ? parseInt(args[1]) : 3000;
        await (0, index_js_1.startWebServer)(port);
    }
    else {
        const userInput = args.join(' ');
        const result = await (0, index_js_1.handleUserNeed)(userInput);
        console.log('\n' + result);
    }
}
// 启动
main().catch(error => {
    console.error('❌ 错误:', error.message || error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map