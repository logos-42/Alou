"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMCPClient = createMCPClient;
exports.callMCPCompass = callMCPCompass;
exports.callMCPInstaller = callMCPInstaller;
exports.callMCPCreate = callMCPCreate;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
// 创建 MCP 客户端连接
async function createMCPClient(command, args, env) {
    // 过滤掉 undefined 的环境变量
    const processEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            processEnv[key] = value;
        }
    }
    const transport = new stdio_js_1.StdioClientTransport({
        command: command,
        args: args || [],
        env: { ...processEnv, ...env }
    });
    const client = new index_js_1.Client({
        name: 'mcp-host-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });
    await client.connect(transport);
    return client;
}
// 调用 MCP Compass 搜索服务（带重试机制）
async function callMCPCompass(query, maxRetries = 3) {
    console.log('🔍 调用 MCP Compass 搜索服务...');
    const config = {
        command: 'npx',
        args: ['-y', '@liuyoshio/mcp-compass']
    };
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let client = null;
        try {
            if (attempt > 1) {
                console.log(`🔄 第 ${attempt} 次重试...`);
                // 重试前等待一段时间
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
            // 创建客户端，设置超时
            client = await Promise.race([
                createMCPClient(config.command, config.args, config.env),
                new Promise((_, reject) => setTimeout(() => reject(new Error('MCP 客户端连接超时')), 5000))
            ]);
            // 列出可用工具
            const tools = await client.listTools();
            console.log('📋 MCP Compass 可用工具:', tools.tools.map(t => t.name));
            // 查找推荐服务的工具
            const recommendTool = tools.tools.find(t => t.name.includes('recommend') || t.name.includes('search'));
            if (recommendTool) {
                // 调用推荐工具，设置超时
                const result = await Promise.race([
                    client.callTool({
                        name: recommendTool.name,
                        arguments: { query }
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('MCP Compass API 调用超时')), 15000))
                ]);
                // 成功则返回结果
                return result;
            }
            throw new Error('未找到 MCP Compass 推荐工具');
        }
        catch (error) {
            // 详细的错误处理
            const isNetworkError = error.message?.includes('fetch failed') ||
                error.message?.includes('CONNECT_TIMEOUT') ||
                error.message?.includes('ECONNREFUSED') ||
                error.message?.includes('连接超时');
            const isServerError = error.code === -32603;
            // 如果是最后一次尝试，打印详细错误
            if (attempt === maxRetries) {
                if (isNetworkError) {
                    console.log('⚠️ MCP Compass 网络连接失败（可能是防火墙或网络问题）');
                }
                else if (isServerError) {
                    console.log('⚠️ MCP Compass 服务内部错误');
                }
                else {
                    console.log('❌ MCP Compass 调用失败:', error.message || error);
                }
                return null;
            }
            // 如果不是网络错误或服务器错误，不必重试
            if (!isNetworkError && !isServerError) {
                console.log('❌ MCP Compass 调用失败:', error.message || error);
                return null;
            }
            // 继续下一次重试
        }
        finally {
            // 确保客户端被正确关闭
            if (client) {
                try {
                    await client.close();
                }
                catch (e) {
                    // 忽略关闭错误
                }
            }
        }
    }
    return null;
}
// 调用 MCP Installer 安装服务
async function callMCPInstaller(packageName) {
    console.log('📦 调用 MCP Installer 安装服务...');
    const config = {
        command: 'npx',
        args: ['-y', '@anaisbetts/mcp-installer']
    };
    let client = null;
    try {
        // 创建客户端
        client = await createMCPClient(config.command, config.args, config.env);
        // 列出可用工具
        const tools = await client.listTools();
        console.log('📋 MCP Installer 可用工具:', tools.tools.map(t => t.name));
        // 查找安装工具
        const installTool = tools.tools.find(t => t.name.includes('install') && t.name.includes('repo'));
        if (installTool) {
            // 调用安装工具
            const result = await client.callTool({
                name: installTool.name,
                arguments: {
                    name: packageName,
                    args: [],
                    env: []
                }
            });
            return result;
        }
        throw new Error('未找到 MCP Installer 安装工具');
    }
    catch (error) {
        console.error('❌ MCP Installer 调用失败:', error.message || error);
        return null;
    }
    finally {
        if (client) {
            try {
                await client.close();
            }
            catch (e) {
                // 忽略关闭错误
            }
        }
    }
}
// 调用 MCP Create 创建服务
async function callMCPCreate(language, code) {
    console.log('🛠️ 调用 MCP Create 创建服务...');
    const config = {
        command: 'node',
        args: ['D:\\AI\\ALOU\\mcp-create\\build\\index.js']
    };
    let client = null;
    try {
        // 创建客户端
        client = await createMCPClient(config.command, config.args, config.env);
        // 列出可用工具
        const tools = await client.listTools();
        console.log('📋 MCP Create 可用工具:', tools.tools.map(t => t.name));
        // 查找创建服务的工具
        const createTool = tools.tools.find(t => t.name.includes('create') && t.name.includes('server'));
        if (createTool) {
            // 调用创建工具
            const result = await client.callTool({
                name: createTool.name,
                arguments: {
                    language,
                    code
                }
            });
            return result;
        }
        throw new Error('未找到 MCP Create 创建工具');
    }
    catch (error) {
        console.error('❌ MCP Create 调用失败:', error.message || error);
        return null;
    }
    finally {
        if (client) {
            try {
                await client.close();
            }
            catch (e) {
                // 忽略关闭错误
            }
        }
    }
}
//# sourceMappingURL=mcp-client.js.map