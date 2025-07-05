// @ts-nocheck
/*
  使用 Node.js 原生 https 实现对 DeepSeek/OpenAI 兼容接口的调用，
  避免 axios 带来的 CommonJS 包缺失问题，方便 pkg 打包。
*/

import * as https from 'https';
import { URL } from 'url';

export interface ParsedNeed {
  service_type: string;
  keywords: string[];
  action: 'search' | 'create';
  description: string;
  deep_need?: string;
  workflows?: { name: string; steps: string[] }[];
  mcp_tools?: { name: string; description: string }[];
}

export interface LLMConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

function httpsRequest(urlStr: string, data: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);

    const req = https.request({
      method: 'POST',
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      },
      timeout: 60000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

export async function askLLM(prompt: string, config?: Partial<LLMConfig>): Promise<string> {
  const apiKey = config?.apiKey || process.env.LLM_API_KEY || 'sk-392a95fc7d2445f6b6c79c17725192d1';
  const apiUrl = config?.apiUrl || process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
  const model  = config?.model  || process.env.LLM_MODEL   || 'deepseek-chat';

  

  const payload = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: '你是一个 MCP 服务助手，帮助用户找到或创建合适的 MCP 服务。请用中文回复。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: false
  });

  try {
    console.log('📤 发送请求到 LLM...');
    const raw = await httpsRequest(apiUrl, payload, {
      'Authorization': `Bearer ${apiKey}`
    });

    // 先尝试解析为 JSON
    let json;
    try {
      json = JSON.parse(raw);
    } catch (parseError) {
      console.error('❌ 响应不是有效的 JSON:', raw.substring(0, 200));
      throw new Error('LLM 返回了无效的响应格式');
    }
    
    // 检查是否有错误
    if (json.error) {
      console.error('❌ LLM API 错误:', json.error);
      // 如果是认证错误，提供更清晰的提示
      if (json.error.code === 'invalid_api_key' || json.error.message?.includes('Authentic')) {
        throw new Error('API Key 无效，请检查你的 DeepSeek API Key');
      }
      throw new Error(json.error.message || 'LLM API 错误');
    }
    
    if (json.choices && json.choices[0] && json.choices[0].message) {
      return json.choices[0].message.content as string;
    }
    
    console.error('❌ 响应格式不正确:', json);
    throw new Error('Invalid LLM response format');
  } catch (error) {
    console.error('❌ LLM 调用失败:', error);
    throw error;
  }
}

export async function parseUserNeed(userInput: string): Promise<ParsedNeed> {
  const prompt = `分析用户需求并返回 JSON 格式的结果。

用户需求："${userInput}"

请进行以下8个维度的深度分析：
1. 表面需求 vs 深层动机：用户说想要什么，但真正需要的可能是什么？
2. 前置条件：实现这个需求需要哪些前置准备？
3. 执行过程的困难：用户在实现过程中会遇到哪些技术/操作难点？
4. 隐性需求：用户没有明说但肯定需要的功能
5. 工作流程：完成任务的具体步骤
6. 所需工具：每个步骤需要什么样的MCP工具
7. 边缘情况：可能出现的异常情况
8. 后续需求：完成后用户可能还需要什么



返回JSON格式（只返回JSON，不要有其他文字）：
{
  "service_type": "服务类型",
  "keywords": ["关键词数组"],
  "action": "search",
  "description": "一句话描述需求",
  "deep_need": "深层需求分析（用户真正想要解决的问题）",
  "workflows": [
    {
      "name": "工作流名称",
      "steps": ["步骤1", "步骤2", "步骤3"]
    }
  ],
  "mcp_tools": [
    {
      "name": "工具名称",
      "description": "工具用途"
    }
  ]
}`;

  try {
    console.log('🤖 调用 LLM 进行深度需求分析...');
    const res = await askLLM(prompt);
    
    // 尝试提取 JSON
    let jsonStr = res;
    const jsonMatch = res.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const obj = JSON.parse(jsonStr);
    
    // 确保必要字段存在
    if (!obj.service_type) obj.service_type = 'general';
    if (!obj.keywords || !Array.isArray(obj.keywords)) obj.keywords = [userInput];
    if (!obj.action) obj.action = 'search';
    if (!obj.description) obj.description = userInput;
    
    console.log('🧠 深度分析完成:', {
      service_type: obj.service_type,
      has_deep_need: !!obj.deep_need,
      workflows_count: obj.workflows?.length || 0,
      tools_count: obj.mcp_tools?.length || 0
    });
    
    return obj as ParsedNeed;
  } catch (error) {
    console.error('⚠️ LLM 分析失败，使用简单解析:', error);
    
    // 改进的回退逻辑
    const keywords = userInput.split(/\s+/).filter(w => w.length > 1);
    const needsCreate = /创建|开发|新建|写一个|制作/.test(userInput);
    let serviceType = 'general';
    
   
    // 返回基础分析结果
    return {
      service_type: serviceType,
      keywords,
      action: needsCreate ? 'create' : 'search',
      description: userInput,
      deep_need: `用户想要${needsCreate ? '创建' : '找到'}一个${serviceType === 'general' ? '' : serviceType + '相关的'}工具来处理: ${userInput}`,
      workflows: [{
        name: '基础流程',
        steps: ['搜索相关服务', '安装或创建服务', '使用服务完成任务']
      }],
      mcp_tools: [{
        name: `${serviceType}-tool`,
        description: `处理${serviceType}相关任务的工具`
      }]
    };
  }
}

export async function generateMCPCode(serviceType: string, keywords: string[], need?: ParsedNeed): Promise<string> {
  let prompt = `生成一个 MCP TypeScript 服务代码。

服务类型: ${serviceType}
关键词: ${keywords.join(', ')}`;

  // 如果有深度需求分析，添加到提示词中
  if (need) {
    prompt += `

深度需求分析:
- 描述: ${need.description}
- 深层需求: ${need.deep_need || '无'}
- 工作流程: ${need.workflows?.map(w => `${w.name}: ${w.steps.join(' → ')}`).join('; ') || '无'}
- 需要的工具: ${need.mcp_tools?.map(t => `${t.name} (${t.description})`).join(', ') || '无'}`;
  }

  prompt += `

请生成完整的 TypeScript 代码，包含所有必要的导入、工具定义和实现。
代码应该可以直接运行，并提供实际有用的功能。`;

  try {
    const res = await askLLM(prompt);
    
    // 提取代码块
    let code = res;
    const codeMatch = res.match(/```(?:typescript|ts)?\n?([\s\S]*?)```/);
    if (codeMatch) {
      code = codeMatch[1].trim();
    } else if (res.includes('import ')) {
      // 可能整个响应就是代码
      code = res.trim();
    }
    
    return code;
  } catch (error) {
    console.error('⚠️ 代码生成失败，使用默认模板:', error);
    
    // 返回一个基础模板
    return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new Server({
  name: '${serviceType}-service',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// TODO: 实现 ${serviceType} 相关的工具
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  // 实现你的工具逻辑
  return {
    content: [{
      type: 'text',
      text: \`调用了工具 \${name}\`
    }]
  };
});

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'example_tool',
        description: '示例工具',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    ]
  };
});

const transport = new StdioServerTransport();
server.connect(transport);`;
  }
} 