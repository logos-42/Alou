"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askLLM = askLLM;
exports.parseUserNeed = parseUserNeed;
exports.generateMCPCode = generateMCPCode;
const axios_1 = __importDefault(require("axios"));
// 通用的 LLM 调用函数
async function askLLM(prompt, config) {
    // 从环境变量读取配置，支持多种 LLM
    const apiKey = config?.apiKey || process.env.LLM_API_KEY || 'sk-392a95fc7d2445f6b6c79c17725192d1';
    // 修正 DeepSeek API URL - 根据官方文档
    const apiUrl = config?.apiUrl || process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
    const model = config?.model || process.env.LLM_MODEL || 'deepseek-chat';
    console.log('🤖 调用 LLM API...');
    console.log('📍 API URL:', apiUrl);
    console.log('📦 模型:', model);
    // 重试机制
    const maxRetries = 3;
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 尝试第 ${attempt}/${maxRetries} 次...`);
            const response = await axios_1.default.post(apiUrl, {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个 MCP 服务助手，帮助用户找到或创建合适的 MCP 服务。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                stream: false // 根据官方文档，明确指定 stream 参数
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 60000, // 60秒超时
                validateStatus: (status) => status < 500, // 处理4xx错误
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            if (response.status >= 400) {
                console.error('❌ LLM API 返回错误:', response.status, response.data);
                throw new Error(`LLM API 错误: ${response.status} - ${JSON.stringify(response.data)}`);
            }
            console.log('✅ LLM API 调用成功');
            // 根据 DeepSeek API 响应格式
            if (response.data && response.data.choices && response.data.choices[0]) {
                return response.data.choices[0].message.content;
            }
            else {
                throw new Error('API 响应格式错误');
            }
        }
        catch (error) {
            lastError = error;
            if (axios_1.default.isAxiosError(error)) {
                console.error(`❌ 第 ${attempt} 次尝试失败:`, {
                    code: error.code,
                    message: error.message,
                    response: error.response?.status,
                    responseData: error.response?.data
                });
                if (error.code === 'ECONNABORTED') {
                    console.error('❌ LLM API 调用超时（60秒）');
                }
                else if (error.code === 'ENOTFOUND') {
                    console.error('❌ 无法解析域名，请检查网络连接');
                }
                else if (error.code === 'ECONNREFUSED') {
                    console.error('❌ 连接被拒绝，请检查 API 地址是否正确');
                }
                else if (error.response) {
                    console.error('❌ LLM API 响应错误:', error.response.status, error.response.data);
                }
                else if (error.request) {
                    console.error('❌ 请求已发送但没有收到响应');
                }
            }
            else {
                console.error(`❌ 第 ${attempt} 次尝试失败:`, error);
            }
            // 如果不是最后一次尝试，等待后重试
            if (attempt < maxRetries) {
                const waitTime = attempt * 2000; // 递增等待时间
                console.log(`⏳ 等待 ${waitTime / 1000} 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    // 所有尝试都失败了
    console.error('❌ 所有 LLM API 调用尝试都失败了');
    throw lastError;
}
// 解析用户需求
async function parseUserNeed(userInput) {
    console.log('🔍 开始解析用户需求...');
    const prompt = `
分析用户需求并返回 JSON 格式的结果：
用户说："${userInput}"

判断规则：
- 如果用户明确说"创建"、"新建"、"开发"、"编写"、"写一个"等词，action 设为 "create"
- 否则 action 设为 "search"（优先搜索现有服务）

请返回以下格式的 JSON（不要包含其他文字）：
{
  "service_type": "服务类型（如 weather、translation、database 等）",
  "keywords": ["关键词1", "关键词2"],
  "action": "search 或 create",
  "description": "进行深入思考后的用户需求的洞察与描述"
}
`;
    try {
        const result = await askLLM(prompt);
        console.log('📝 LLM 返回结果:', result);
        // 尝试解析 JSON
        const parsed = JSON.parse(result);
        console.log('✅ 成功解析用户需求');
        return parsed;
    }
    catch (e) {
        console.error('⚠️ 解析 LLM 返回结果失败:', e);
        // 如果解析失败，尝试提取关键信息
        const keywords = userInput.toLowerCase().split(' ').filter(word => word.length > 2);
        const needsCreate = /创建|新建|开发|编写|写一个|制作|生成/.test(userInput);
        // 尝试识别服务类型
        let serviceType = 'general';
        if (/天气|weather/i.test(userInput))
            serviceType = 'weather';
        else if (/翻译|translate/i.test(userInput))
            serviceType = 'translation';
        else if (/数据库|database|db/i.test(userInput))
            serviceType = 'database';
        else if (/文件|file|fs/i.test(userInput))
            serviceType = 'filesystem';
        else if (/比特币|bitcoin|btc|加密货币|crypto/i.test(userInput))
            serviceType = 'crypto';
        else if (/股票|stock|股市/i.test(userInput))
            serviceType = 'stock';
        else if (/价格|price/i.test(userInput))
            serviceType = 'price';
        console.log('📋 使用备用解析方案');
        return {
            service_type: serviceType,
            keywords: keywords,
            action: needsCreate ? 'create' : 'search',
            description: userInput
        };
    }
}
// 生成 MCP 服务代码
async function generateMCPCode(serviceType, keywords) {
    const prompt = `
生成一个完整的 MCP TypeScript 服务代码，要求：
- 服务类型：${serviceType}
- 功能关键词：${keywords.join(', ')}
- 使用新版 @modelcontextprotocol/sdk
- 包含至少一个实用的工具
- 代码要能直接运行
- 提供有意义的示例数据或模拟实现

生成一个完整的 index.ts 文件，包含：
1. 必要的导入
2. 服务初始化
3. 至少一个工具实现
4. 合理的参数验证
5. 有用的返回值

只返回代码，不要包含markdown标记或其他说明文字。
`;
    try {
        const code = await askLLM(prompt);
        // 移除可能的 markdown 标记
        return code.replace(/^```\w*\n?|```$/gm, '').trim();
    }
    catch (error) {
        console.error('⚠️ LLM 生成代码失败，使用默认模板');
        // 根据服务类型返回默认模板
        if (serviceType === 'crypto' || keywords.some(k => /bitcoin|ethereum|crypto|币/.test(k))) {
            return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "crypto-price-service",
  version: "1.0.0"
});

// 模拟的价格数据
const mockPrices: Record<string, number> = {
  BTC: 45000,
  ETH: 3500,
  BNB: 350,
  USDT: 1
};

server.tool("get-crypto-price",
  { 
    symbol: z.string().describe("加密货币符号，如 BTC, ETH"), 
    currency: z.string().default("USD").describe("法币单位，如 USD, CNY") 
  },
  async ({ symbol, currency }) => {
    const upperSymbol = symbol.toUpperCase();
    const price = mockPrices[upperSymbol];
    
    if (!price) {
      return {
        content: [{
          type: "text",
          text: \`未找到 \${symbol} 的价格数据。支持的币种：\${Object.keys(mockPrices).join(', ')}\`
        }]
      };
    }
    
    // 简单的汇率转换
    const exchangeRate = currency === "CNY" ? 7.2 : 1;
    const convertedPrice = price * exchangeRate;
    
    return {
      content: [{
        type: "text",
        text: \`\${upperSymbol} 当前价格: \${convertedPrice.toFixed(2)} \${currency}\`
      }]
    };
  }
);

server.tool("list-supported-cryptos",
  {},
  async () => ({
    content: [{
      type: "text",
      text: \`支持的加密货币：\${Object.keys(mockPrices).join(', ')}\`
    }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`;
        }
        // 默认通用模板
        return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "${serviceType}-service",
  version: "1.0.0"
});

server.tool("example-tool",
  { input: z.string().describe("输入参数") },
  async ({ input }) => ({
    content: [{
      type: "text",
      text: \`处理结果: \${input}\`
    }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`;
    }
}
//# sourceMappingURL=llm.js.map