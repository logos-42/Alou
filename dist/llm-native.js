"use strict";
// @ts-nocheck
/*
  使用 Node.js 原生 https 实现对 DeepSeek/OpenAI 兼容接口的调用，
  避免 axios 带来的 CommonJS 包缺失问题，方便 pkg 打包。
*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.askLLM = askLLM;
exports.parseUserNeed = parseUserNeed;
exports.generateMCPCode = generateMCPCode;
const https = __importStar(require("https"));
const url_1 = require("url");
function httpsRequest(urlStr, data, headers) {
    return new Promise((resolve, reject) => {
        const url = new url_1.URL(urlStr);
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
async function askLLM(prompt, config) {
    const apiKey = config?.apiKey || process.env.LLM_API_KEY || '';
    const apiUrl = config?.apiUrl || process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';
    const model = config?.model || process.env.LLM_MODEL || 'deepseek-chat';
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
        return json.choices[0].message.content;
    }
    throw new Error('Invalid LLM response');
}
async function parseUserNeed(userInput) {
    const prompt = `分析用户需求并返回 JSON 结果，字段：service_type, keywords, action("search"|"create"), description。用户说："${userInput}"`;
    try {
        const res = await askLLM(prompt);
        const obj = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
        return obj;
    }
    catch {
        const keywords = userInput.split(/\s+/).filter(w => w.length > 1);
        const needsCreate = /创建|开发|新建|写一个|制作/.test(userInput);
        let serviceType = 'general';
        if (/天气|weather/i.test(userInput))
            serviceType = 'weather';
        if (/翻译|translate/i.test(userInput))
            serviceType = 'translation';
        return {
            service_type: serviceType,
            keywords,
            action: needsCreate ? 'create' : 'search',
            description: userInput
        };
    }
}
async function generateMCPCode(serviceType, keywords) {
    const prompt = `生成一个 MCP TypeScript 服务代码，服务类型:${serviceType} 关键词:${keywords.join(',')}`;
    try {
        const res = await askLLM(prompt);
        const code = res.replace(/```[\s\S]*?\n([\s\S]*?)```/, '$1').trim();
        return code;
    }
    catch {
        return `// TODO: implement ${serviceType} service`;
    }
}
//# sourceMappingURL=llm-native.js.map