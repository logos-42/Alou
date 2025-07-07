"use strict";
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
exports.addRegistry = addRegistry;
exports.searchRegistry = searchRegistry;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const llm_js_1 = require("./llm.js");
const registryPath = path.join(process.cwd(), 'mcp-services', 'registry.json');
async function readRegistry() {
    try {
        const raw = await fs.readFile(registryPath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
async function addRegistry(record) {
    const list = await readRegistry();
    // 去重
    if (!list.find(r => r.id === record.id)) {
        list.push(record);
        await fs.mkdir(path.dirname(registryPath), { recursive: true });
        await fs.writeFile(registryPath, JSON.stringify(list, null, 2));
    }
}
async function searchRegistry(queryWords) {
    const list = await readRegistry();
    // 如果没有服务，直接返回
    if (list.length === 0) {
        console.log('📭 Registry 为空，跳过本地搜索');
        return null;
    }
    console.log('🔍 Registry 搜索关键词:', queryWords);
    try {
        // 使用 AI 进行智能匹配
        const userQuery = queryWords.join(' ');
        const servicesInfo = list.map(rec => `ID: ${rec.id}\n类型: ${rec.service_type}\n标题: ${rec.title}\n标签: ${rec.tags.join(', ')}`).join('\n\n');
        const prompt = `
分析用户需求并找出最匹配的 MCP 服务。

用户需求: ${userQuery}

可用服务列表:
${servicesInfo}

请分析用户需求与每个服务的匹配程度，返回最佳匹配的服务。

要求:
1. 理解用户需求的语义含义
2. 分析每个服务的功能和适用场景
3. 计算匹配度分数 (0-100)
4. 如果最高分数 >= 60，返回该服务ID；否则返回 null

请直接返回JSON格式，不要包含其他内容：
{
  "best_match": "服务ID或null",
  "score": 匹配分数(0-100),
  "reason": "匹配原因"
}
`;
        console.log('🤖 使用 AI 分析服务匹配度...');
        const result = await (0, llm_js_1.askLLM)(prompt);
        // 解析 AI 响应
        const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleanResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            console.log('🧠 AI 分析结果:', analysis);
            if (analysis.best_match && analysis.score >= 60) {
                const matchedService = list.find(rec => rec.id === analysis.best_match);
                if (matchedService) {
                    console.log(`🎯 Registry AI 命中: ${matchedService.title} (分数: ${analysis.score})`);
                    console.log(`💡 匹配原因: ${analysis.reason}`);
                    return matchedService;
                }
            }
        }
        console.log('❌ Registry AI 未找到匹配的服务');
        return null;
    }
    catch (error) {
        console.error('⚠️ Registry AI 匹配失败，使用备用方案:', error);
        // 备用方案：简单的关键词匹配
        let best = null;
        let bestScore = 0;
        for (const rec of list) {
            const text = `${rec.tags.join(' ')} ${rec.service_type} ${rec.title} ${rec.id}`.toLowerCase();
            let score = 0;
            for (const word of queryWords) {
                const lowerWord = word.toLowerCase();
                if (text.includes(lowerWord)) {
                    score += 1;
                }
            }
            if (score > bestScore) {
                best = rec;
                bestScore = score;
            }
        }
        if (bestScore > 0) {
            console.log(`🎯 Registry 备用匹配: ${best.title} (分数: ${bestScore})`);
            return best;
        }
        return null;
    }
}
//# sourceMappingURL=registry.js.map