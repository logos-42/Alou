#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 这是 CLI 入口文件，直接调用 src/index.ts 中导出的 main 函数
const index_js_1 = require("./index.js");
(0, index_js_1.main)().catch((err) => {
    console.error('CLI 运行失败:', err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map