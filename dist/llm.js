"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeLearningNeeds = exports.generateMCPCode = exports.parseUserNeed = exports.askLLM = void 0;
// 直接使用 llm-native.ts 中的实现来避免 axios 打包问题
var llm_native_js_1 = require("./llm-native.js");
Object.defineProperty(exports, "askLLM", { enumerable: true, get: function () { return llm_native_js_1.askLLM; } });
Object.defineProperty(exports, "parseUserNeed", { enumerable: true, get: function () { return llm_native_js_1.parseUserNeed; } });
Object.defineProperty(exports, "generateMCPCode", { enumerable: true, get: function () { return llm_native_js_1.generateMCPCode; } });
// 重新导出分析学习需求的函数
var llm_native_js_2 = require("./llm-native.js");
Object.defineProperty(exports, "analyzeLearningNeeds", { enumerable: true, get: function () { return llm_native_js_2.parseUserNeed; } });
//# sourceMappingURL=llm.js.map