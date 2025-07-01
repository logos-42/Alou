import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
  'hello': { 'zh': '你好', 'es': 'hola', 'fr': 'bonjour', 'ja': 'こんにちは' },
  'world': { 'zh': '世界', 'es': 'mundo', 'fr': 'monde', 'ja': '世界' },
  'thank you': { 'zh': '谢谢', 'es': 'gracias', 'fr': 'merci', 'ja': 'ありがとう' },
  'goodbye': { 'zh': '再见', 'es': 'adiós', 'fr': 'au revoir', 'ja': 'さようなら' },
  'please': { 'zh': '请', 'es': 'por favor', 'fr': 's\'il vous plaît', 'ja': 'お願いします' }
};

// 语言检测
function detectLanguage(text: string): string {
  const patterns = {
    'zh': /[\u4e00-\u9fa5]/,
    'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
    'es': /[áéíóúñ¿¡]/i,
    'fr': /[àâäéèêëïîôùûüÿç]/i
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  
  return 'en'; // 默认英语
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'translate',
        description: '翻译文本到指定语言',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '要翻译的文本' },
            targetLang: { type: 'string', description: '目标语言代码，如 zh, es, fr, ja' },
            sourceLang: { type: 'string', description: '源语言代码（可选，会自动检测）' }
          },
          required: ['text', 'targetLang']
        }
      },
      {
        name: 'detect_language',
        description: '检测文本的语言',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '要检测的文本' }
          },
          required: ['text']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'translate') {
    if (!request.params.arguments) {
      throw new Error('Missing arguments');
    }
    
    const text = request.params.arguments.text as string;
    const targetLang = request.params.arguments.targetLang as string;
    const sourceLang = request.params.arguments.sourceLang as string || detectLanguage(text);
    
    // 尝试查找预定义的翻译
    const translation = translations[text.toLowerCase()]?.[targetLang];
    
    if (translation) {
      return {
        content: [{
          type: 'text',
          text: `翻译结果 (${sourceLang} → ${targetLang}): ${translation}`
        }]
      };
    }
    
    // 模拟翻译（实际应调用翻译 API）
    return {
      content: [{
        type: 'text',
        text: `[模拟翻译] ${text} → [${targetLang}] ${text}_translated`
      }]
    };
  }
  
  if (request.params.name === 'detect_language') {
    if (!request.params.arguments) {
      throw new Error('Missing arguments');
    }
    
    const text = request.params.arguments.text as string;
    const detectedLang = detectLanguage(text);
    
    const langNames: Record<string, string> = {
      'en': '英语',
      'zh': '中文',
      'es': '西班牙语',
      'fr': '法语',
      'ja': '日语'
    };
    
    return {
      content: [{
        type: 'text',
        text: `检测到的语言: ${langNames[detectedLang] || detectedLang}`
      }]
    };
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Translation service is running');
}

main().catch(console.error);