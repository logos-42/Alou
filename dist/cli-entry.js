#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// MCP Host CLI 入口 - 带完整错误处理
console.log('[DEBUG] 启动 MCP Host CLI...');
const index_js_1 = require("./index");
// 确保错误能被捕获和显示
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的 Promise 拒绝:', reason);
    process.exit(1);
});
async function main() {
    try {
        console.log('[DEBUG] 解析命令行参数...');
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
            console.log('[DEBUG] 启动 Web 服务器模式...');
            const port = args[1] ? parseInt(args[1]) : 3000;
            await (0, index_js_1.startWebServer)(port);
        }
        else {
            console.log('[DEBUG] 处理用户需求...');
            const userInput = args.join(' ');
            const result = await (0, index_js_1.handleUserNeed)(userInput);
            console.log('\n' + result);
        }
    }
    catch (error) {
        console.error('❌ 运行时错误:', error.message || error);
        console.error('堆栈跟踪:', error.stack);
        process.exit(1);
    }
}
// 启动
console.log('[DEBUG] 调用 main 函数...');
main().then(() => {
    console.log('[DEBUG] 程序正常结束');
}).catch(error => {
    console.error('❌ Main 函数错误:', error);
    process.exit(1);
});
//# sourceMappingURL=cli-entry.js.map