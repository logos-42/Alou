// 直接使用 llm-native.ts 中的实现来避免 axios 打包问题
export { askLLM, parseUserNeed, generateMCPCode, ParsedNeed, LLMConfig } from './llm-native.js';

// 重新导出分析学习需求的函数
export { parseUserNeed as analyzeLearningNeeds } from './llm-native.js'; 