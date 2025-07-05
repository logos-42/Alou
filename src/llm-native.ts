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
  const apiKey = config?.apiKey || process.env.LLM_API_KEY || '';
  const apiUrl = config?.apiUrl || process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
  const model  = config?.model  || process.env.LLM_MODEL   || 'deepseek-reasoner';

  const payload = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: '你是一个 MCP 服务助手，帮助用户找到或创建合适的 MCP 服务。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: false
  });

  const raw = await httpsRequest(apiUrl, payload, {
    'Authorization': `Bearer ${apiKey}`
  });

  const json = JSON.parse(raw);
  if (json.choices && json.choices[0] && json.choices[0].message) {
    return json.choices[0].message.content as string;
  }
  throw new Error('Invalid LLM response');
}

export async function parseUserNeed(userInput: string): Promise<ParsedNeed> {
  const prompt = `请深度分析以下需求，识别用户在实现目标过程中可能遇到的所有隐性困难和痛点。基于人类经验和专业知识，预判用户将需要哪些具体工具。输出 JSON（不要包含其他文字），字段：service_type, keywords, action("search"|"create"), description, deep_need, workflows, mcp_tools。用户说:"${userInput}"`;
  try {
    const res = await askLLM(prompt);
    const obj = JSON.parse(res.match(/\{[\s\S]*\}/)![0]);
    return obj as ParsedNeed;
  } catch {
    const keywords = userInput.split(/\s+/).filter(w => w.length > 1);
    const needsCreate = /创建|开发|新建|写一个|制作/.test(userInput);
    let serviceType = 'general';
    if (/天气|weather/i.test(userInput)) serviceType = 'weather';
    if (/翻译|translate/i.test(userInput)) serviceType = 'translation';
    return {
      service_type: serviceType,
      keywords,
      action: needsCreate ? 'create' : 'search',
      description: userInput
    };
  }
}

export async function generateMCPCode(serviceType: string, keywords: string[]): Promise<string> {
  const prompt = `生成一个 MCP TypeScript 服务代码，服务类型:${serviceType} 关键词:${keywords.join(',')}`;
  try {
    const res = await askLLM(prompt);
    const code = res.replace(/```[\s\S]*?\n([\s\S]*?)```/, '$1').trim();
    return code;
  } catch {
    return `// TODO: implement ${serviceType} service`;
  }
} 