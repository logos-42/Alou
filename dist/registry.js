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
    let best = null;
    let bestScore = 0;
    for (const rec of list) {
        const text = rec.tags.join(' ').toLowerCase();
        const score = queryWords.filter(w => text.includes(w.toLowerCase())).length;
        if (score > bestScore) {
            best = rec;
            bestScore = score;
        }
    }
    return bestScore > 0 ? best : null;
}
//# sourceMappingURL=registry.js.map