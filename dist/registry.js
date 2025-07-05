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
    let best = null;
    let bestScore = 0;
    // 处理 queryWords，提取有意义的词
    const cleanWords = [];
    for (const word of queryWords) {
        // 如果是一个长句子，拆分成单词
        if (word.length > 10) {
            cleanWords.push(...word.split(/[\s，。、]/g).filter(w => w.length > 1));
        }
        else {
            cleanWords.push(word);
        }
    }
    console.log('🔍 Registry 搜索关键词:', cleanWords);
    for (const rec of list) {
        const text = `${rec.tags.join(' ')} ${rec.service_type} ${rec.title} ${rec.id}`.toLowerCase();
        let score = 0;
        // 计算匹配分数
        for (const word of cleanWords) {
            const lowerWord = word.toLowerCase();
            if (text.includes(lowerWord)) {
                score += 1;
                // 核心词汇加权
                if (['music', '音乐', '小提琴', 'violin', '乐器', 'instrument'].includes(lowerWord)) {
                    score += 3;
                }
                else if (['stock', '股票', 'analysis', '分析', 'market', '市场'].includes(lowerWord)) {
                    score += 2;
                }
                else if (['学习', 'learn', 'learning', '练习', 'practice'].includes(lowerWord)) {
                    score += 2;
                }
            }
        }
        // 服务类型完全匹配额外加分
        if (cleanWords.includes(rec.service_type)) {
            score += 5;
        }
        if (score > bestScore) {
            best = rec;
            bestScore = score;
        }
    }
    // 调试输出
    if (bestScore > 0) {
        console.log(`🎯 Registry 命中: ${best.title} (分数: ${bestScore})`);
    }
    else {
        console.log('❌ Registry 未找到匹配的服务');
    }
    return bestScore > 0 ? best : null;
}
//# sourceMappingURL=registry.js.map