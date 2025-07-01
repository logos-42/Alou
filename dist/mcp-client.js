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
// 调用 MCP Create 创建服务（支持服务类型）
async function callMCPCreate(language, code, serviceType) {
    console.log('🛠️ 调用 MCP Create 创建服务...');
    // 尝试多个 MCP Create 服务
    const configs = [
        {
            // 尝试原始的 MCP Create（如果存在）
            command: 'npx',
            args: ['-y', '@tesla0225/mcp-create']
        },
        {
            // 备用方案 1：使用 @mcpdotdirect/create-mcp-server
            command: 'npx',
            args: ['-y', '@mcpdotdirect/create-mcp-server', '--skip-prompts']
        },
        {
            // 备用方案 2：使用本地的 mcp-server-creator
            command: 'python',
            args: ['D:\\AI\\ALOU\\MCP-Server-Creator\\mcp_server_creator\\mcp_server_creator.py'],
            env: { MCP_TRANSPORT: 'stdio' }
        }
    ];
    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        let client = null;
        try {
            console.log(`🔄 尝试方案 ${i + 1}: ${config.command} ${config.args?.[0]}`);
            // 特殊处理 @mcpdotdirect/create-mcp-server - 它是一个脚手架工具，不是 MCP 服务
            if (config.args?.[0]?.includes('@mcpdotdirect/create-mcp-server')) {
                console.log('⚠️ 注意：@mcpdotdirect/create-mcp-server 是一个脚手架工具，跳过');
                continue;
            }
            // 创建客户端，设置较长的超时时间（MCP Create 可能需要较长时间）
            client = await Promise.race([
                createMCPClient(config.command, config.args, config.env),
                new Promise((_, reject) => setTimeout(() => reject(new Error('MCP 客户端连接超时')), 10000))
            ]);
            // 列出可用工具
            const tools = await client.listTools();
            console.log('📋 MCP 服务可用工具:', tools.tools.map(t => t.name));
            // 处理不同的 MCP 服务
            if (config.args?.[0]?.includes('MCP-Server-Creator')) {
                // MCP Server Creator 使用不同的参数结构
                const createServerTool = tools.tools.find(t => t.name === 'create_server');
                if (createServerTool) {
                    console.log(`✅ 找到 MCP Server Creator 工具: ${createServerTool.name}`);
                    // 首先创建服务
                    const serverName = serviceType ? `${serviceType}-service` : `mcp-service-${Date.now()}`;
                    const createResult = await client.callTool({
                        name: 'create_server',
                        arguments: {
                            name: serverName,
                            description: `${serviceType || 'Custom'} MCP service`,
                            version: '1.0.0'
                        }
                    });
                    console.log('📝 服务创建成功，获取服务ID...');
                    // 从结果中提取 server_id
                    let serverId = null;
                    if (createResult && createResult.content && Array.isArray(createResult.content)) {
                        for (const item of createResult.content) {
                            if (item.type === 'text' && item.text) {
                                // 尝试多种模式匹配服务 ID
                                const patterns = [
                                    /Server ID: (\S+)/,
                                    /server_id[:\s]+(\S+)/i,
                                    /ID[:\s]+(\S+)/,
                                    /Created server with ID[:\s]+(\S+)/i,
                                    /Server "([^"]+)" created/
                                ];
                                for (const pattern of patterns) {
                                    const match = item.text.match(pattern);
                                    if (match) {
                                        serverId = match[1];
                                        break;
                                    }
                                }
                                // 如果文本中包含服务名称，也可以作为 ID 使用
                                if (!serverId && item.text.includes(serverName)) {
                                    serverId = serverName;
                                }
                            }
                        }
                    }
                    // 如果还是没有找到服务 ID，使用服务名作为备用
                    if (!serverId) {
                        console.log('⚠️ 未找到服务 ID，使用服务名作为 ID');
                        serverId = serverName;
                    }
                    if (serverId) {
                        console.log(`✅ 服务ID: ${serverId}`);
                        // 根据语言添加适当的工具
                        if (language === 'typescript' || language === 'python') {
                            // 添加一个示例工具
                            const addToolResult = await client.callTool({
                                name: 'add_tool',
                                arguments: {
                                    server_id: serverId,
                                    tool_name: `get_${serviceType || 'data'}`,
                                    description: `Get ${serviceType || 'data'} information`,
                                    parameters: [
                                        { name: 'query', type: 'str', default: '' }
                                    ],
                                    return_type: 'dict',
                                    is_async: false,
                                    implementation: code // 使用传入的代码作为实现
                                }
                            });
                            console.log('📝 工具添加成功');
                        }
                        // 生成服务代码
                        const generateCodeResult = await client.callTool({
                            name: 'generate_server_code',
                            arguments: {
                                server_id: serverId,
                                include_comments: true
                            }
                        });
                        console.log('✅ MCP Server Creator 调用成功');
                        return generateCodeResult;
                    }
                }
            }
            else {
                // 其他 MCP Create 服务
                const createTool = tools.tools.find(t => t.name.includes('create') && (t.name.includes('server') || t.name.includes('mcp')));
                if (createTool) {
                    console.log(`✅ 找到创建工具: ${createTool.name}`);
                    // 调用创建工具，设置较长的超时时间
                    const result = await Promise.race([
                        client.callTool({
                            name: createTool.name,
                            arguments: {
                                language,
                                code,
                                server_name: `mcp-${Date.now()}`,
                                include_comments: true
                            }
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('MCP API 调用超时')), 30000))
                    ]);
                    console.log('✅ MCP 服务调用成功');
                    return result;
                }
            }
            throw new Error('未找到合适的创建工具');
        }
        catch (error) {
            console.error(`❌ 方案 ${i + 1} 失败:`, error.message || error);
            // 如果是 Windows 系统且出现 cmd.exe 相关错误，提供更具体的错误信息
            if (process.platform === 'win32' && error.message?.includes('cmd.exe')) {
                console.log('💡 提示: Windows 系统下可能存在兼容性问题');
            }
            // 如果不是最后一个方案，继续尝试下一个
            if (i < configs.length - 1) {
                console.log('📝 尝试下一个方案...');
            }
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
    // 所有方案都失败了
    console.log('⚠️ 所有 MCP Create 方案都失败了，将使用本地代码生成');
    return null;
}
//# sourceMappingURL=mcp-client.js.map