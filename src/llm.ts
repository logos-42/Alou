import axios from 'axios';

// LLM 需求解析结果接口
export interface ParsedNeed {
  service_type: string;
  keywords: string[];
  action: 'search' | 'create';
  description: string;
}

// LLM 配置接口
export interface LLMConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

// 通用的 LLM 调用函数
export async function askLLM(prompt: string, config?: LLMConfig): Promise<any> {
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
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 尝试第 ${attempt}/${maxRetries} 次...`);
      
      const response = await axios.post(
        apiUrl,
        {
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
          stream: false  // 根据官方文档，明确指定 stream 参数
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
          timeout: 60000, // 60秒超时
          validateStatus: (status) => status < 500, // 处理4xx错误
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (response.status >= 400) {
        console.error('❌ LLM API 返回错误:', response.status, response.data);
        throw new Error(`LLM API 错误: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      console.log('✅ LLM API 调用成功');
      // 根据 DeepSeek API 响应格式
      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('API 响应格式错误');
      }
    } catch (error) {
      lastError = error;
      
      if (axios.isAxiosError(error)) {
        console.error(`❌ 第 ${attempt} 次尝试失败:`, {
          code: error.code,
          message: error.message,
          response: error.response?.status,
          responseData: error.response?.data
        });
        
        if (error.code === 'ECONNABORTED') {
          console.error('❌ LLM API 调用超时（60秒）');
        } else if (error.code === 'ENOTFOUND') {
          console.error('❌ 无法解析域名，请检查网络连接');
        } else if (error.code === 'ECONNREFUSED') {
          console.error('❌ 连接被拒绝，请检查 API 地址是否正确');
        } else if (error.response) {
          console.error('❌ LLM API 响应错误:', error.response.status, error.response.data);
        } else if (error.request) {
          console.error('❌ 请求已发送但没有收到响应');
        }
      } else {
        console.error(`❌ 第 ${attempt} 次尝试失败:`, error);
      }

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 递增等待时间
        console.log(`⏳ 等待 ${waitTime/1000} 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // 所有尝试都失败了
  console.error('❌ 所有 LLM API 调用尝试都失败了');
  throw lastError;
}

// 解析用户需求
export async function parseUserNeed(userInput: string): Promise<ParsedNeed> {
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
  } catch (e) {
    console.error('⚠️ 解析 LLM 返回结果失败:', e);
    
    // 如果解析失败，尝试提取关键信息
    const keywords = userInput.toLowerCase().split(' ').filter(word => word.length > 2);
    const needsCreate = /创建|新建|开发|编写|写一个|制作|生成/.test(userInput);
    
    // 尝试识别服务类型
    let serviceType = 'general';
    if (/天气|weather/i.test(userInput)) serviceType = 'weather';
    else if (/翻译|translate/i.test(userInput)) serviceType = 'translation';
    else if (/数据库|database|db/i.test(userInput)) serviceType = 'database';
    else if (/文件|file|fs/i.test(userInput)) serviceType = 'filesystem';
    else if (/比特币|bitcoin|btc|加密货币|crypto/i.test(userInput)) serviceType = 'crypto';
    else if (/股票|stock|股市/i.test(userInput)) serviceType = 'stock';
    else if (/价格|price/i.test(userInput)) serviceType = 'price';
    
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
export async function generateMCPCode(serviceType: string, keywords: string[]): Promise<string> {
  const prompt = `
生成一个完整的 MCP TypeScript 服务代码，要求：
- 服务类型：${serviceType}
- 功能关键词：${keywords.join(', ')}
- 使用正确的 @modelcontextprotocol/sdk API
- 包含至少一个实用的工具
- 代码要能直接运行
- 提供有意义的示例数据或模拟实现

重要：使用以下正确的 API 结构：
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

只返回 TypeScript 代码，不要包含任何 Python 代码或其他语言的代码。
不要包含 markdown 标记或其他说明文字。
`;

  try {
    const code = await askLLM(prompt);
    // 移除可能的 markdown 标记和 Python 代码
    let cleanCode = code.replace(/^```\w*\n?|```$/gm, '').trim();
    
    // 移除任何 Python 代码（如 if __name__ == "__main__"）
    cleanCode = cleanCode.replace(/if\s+__name__\s*==\s*["']__main__["'][\s\S]*/g, '');
    cleanCode = cleanCode.replace(/^\s*mcp\.run\(\).*$/gm, '');
    
    return cleanCode.trim();
  } catch (error) {
    console.error('⚠️ LLM 生成代码失败，使用默认模板');
    
    // 根据服务类型返回正确的模板
    if (serviceType === 'crypto' || keywords.some(k => /bitcoin|ethereum|crypto|币/.test(k))) {
      return getCryptoTemplate();
    } else if (serviceType === 'translation' || keywords.some(k => /翻译|translate/.test(k))) {
      return getTranslationTemplate();
    } else if (serviceType === 'video' || keywords.some(k => /视频|video/.test(k))) {
      return getVideoTemplate();
    }
    
    // 默认通用模板
    return getDefaultTemplate(serviceType);
  }
}

// 加密货币服务模板
function getCryptoTemplate(): string {
  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'crypto-price-service',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// 模拟的价格数据
const mockPrices: Record<string, number> = {
  BTC: 45000,
  ETH: 3500,
  BNB: 350,
  USDT: 1
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'get_crypto_price',
      description: '获取加密货币价格',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: '加密货币符号，如 BTC, ETH' },
          currency: { type: 'string', default: 'USD', description: '法币单位' }
        },
        required: ['symbol']
      }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_crypto_price') {
    const symbol = (request.params.arguments.symbol as string).toUpperCase();
    const currency = request.params.arguments.currency || 'USD';
    const price = mockPrices[symbol];
    
    if (!price) {
      return {
        content: [{
          type: 'text',
          text: \`未找到 \${symbol} 的价格数据。支持的币种：\${Object.keys(mockPrices).join(', ')}\`
        }]
      };
    }
    
    const exchangeRate = currency === 'CNY' ? 7.2 : 1;
    const convertedPrice = price * exchangeRate;
    
    return {
      content: [{
        type: 'text',
        text: \`\${symbol} 当前价格: \${convertedPrice.toFixed(2)} \${currency}\`
      }]
    };
  }
  
  throw new Error('Tool not found');
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`;
}

// 翻译服务模板
function getTranslationTemplate(): string {
  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'translation-service',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// 模拟翻译数据
const translations: Record<string, Record<string, string>> = {
  'hello': { 'zh': '你好', 'es': 'hola', 'fr': 'bonjour' },
  'world': { 'zh': '世界', 'es': 'mundo', 'fr': 'monde' },
  'thank you': { 'zh': '谢谢', 'es': 'gracias', 'fr': 'merci' }
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'translate',
      description: '翻译文本到指定语言',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要翻译的文本' },
          targetLang: { type: 'string', description: '目标语言代码，如 zh, es, fr' }
        },
        required: ['text', 'targetLang']
      }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'translate') {
    const text = request.params.arguments.text as string;
    const targetLang = request.params.arguments.targetLang as string;
    
    const translation = translations[text.toLowerCase()]?.[targetLang];
    
    if (translation) {
      return {
        content: [{
          type: 'text',
          text: \`翻译结果: \${translation}\`
        }]
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: \`[模拟翻译] \${text} → [\${targetLang}]\`
      }]
    };
  }
  
  throw new Error('Tool not found');
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`;
}

// 视频服务模板
function getVideoTemplate(): string {
  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'video-recommendation-service',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// 模拟视频数据
const videos = [
  { id: 'v001', title: '美丽风景合集', views: 1200000, category: 'travel' },
  { id: 'v002', title: '搞笑动物集锦', views: 850000, category: 'funny' },
  { id: 'v003', title: '美食制作教程', views: 950000, category: 'food' },
  { id: 'v004', title: '健身训练指南', views: 680000, category: 'fitness' },
  { id: 'v005', title: '科技产品评测', views: 1100000, category: 'tech' }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'recommend_videos',
      description: '推荐好看的视频',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: '视频分类' },
          limit: { type: 'number', default: 5, description: '返回数量' }
        }
      }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'recommend_videos') {
    const category = request.params.arguments.category as string;
    const limit = (request.params.arguments.limit as number) || 5;
    
    let filtered = videos;
    if (category) {
      filtered = videos.filter(v => v.category === category);
    }
    
    const recommended = filtered
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
    
    const result = recommended.map(v => 
      \`• \${v.title} (\${v.views.toLocaleString()} 次观看)\`
    ).join('\\n');
    
    return {
      content: [{
        type: 'text',
        text: result || '没有找到相关视频'
      }]
    };
  }
  
  throw new Error('Tool not found');
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`;
}

// 默认模板
function getDefaultTemplate(serviceType: string): string {
  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: '${serviceType}-service',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'example_tool',
      description: 'An example tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' }
        },
        required: ['input']
      }
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'example_tool') {
    const input = request.params.arguments.input;
    
    return {
      content: [{
        type: 'text',
        text: \`处理结果: \${input}\`
      }]
    };
  }
  
  throw new Error('Tool not found');
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`;
} 