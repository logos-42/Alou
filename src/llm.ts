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
  const apiUrl = config?.apiUrl || process.env.LLM_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  const model = config?.model || process.env.LLM_MODEL || 'deepseek-chat';

  try {
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
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('LLM API 调用失败:', error);
    throw error;
  }
}

// 解析用户需求
export async function parseUserNeed(userInput: string): Promise<ParsedNeed> {
  const prompt = `
分析用户需求并返回 JSON 格式的结果：
用户说："${userInput}"

请返回以下格式的 JSON（不要包含其他文字）：
{
  "service_type": "服务类型（如 weather、translation、database 等）",
  "keywords": ["关键词1", "关键词2"],
  "action": "search 或 create（优先搜索现有服务）",
  "description": "用户需求的简短描述"
}
`;

  const result = await askLLM(prompt);
  try {
    return JSON.parse(result);
  } catch (e) {
    // 如果解析失败，返回默认值
    return {
      service_type: 'general',
      keywords: [userInput],
      action: 'search',
      description: userInput
    };
  }
}

// 生成 MCP 服务代码
export async function generateMCPCode(serviceType: string, keywords: string[]): Promise<string> {
  const prompt = `
生成一个最小的 MCP TypeScript 服务代码，要求：
- 服务类型：${serviceType}
- 功能关键词：${keywords.join(', ')}
- 使用新版 @modelcontextprotocol/sdk (McpServer 类)
- 包含一个示例工具
- 代码要能直接运行

使用以下模板格式：
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "${serviceType}-service",
  version: "1.0.0"
});

server.tool("工具名",
  { 参数: z.string().describe("参数描述") },
  async ({ 参数 }) => ({
    content: [{ type: "text", text: "结果" }]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);

只返回代码，不要包含markdown标记或其他说明文字。
`;

  const code = await askLLM(prompt);
  // 移除可能的 markdown 标记
  return code.replace(/^```\w*\n?|```$/gm, '').trim();
} 