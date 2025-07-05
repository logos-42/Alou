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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceManager = void 0;
const fs = __importStar(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const mcp_client_js_1 = require("./mcp-client.js");
class ServiceManager {
    services = new Map();
    procs = new Map();
    clients = new Map();
    /** 递归扫描 mcp-services 目录，加载所有 mcp-config.json */
    async loadAll(dir = path_1.default.join(process.cwd(), 'mcp-services')) {
        let entries = [];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const full = path_1.default.join(dir, entry.name || entry);
            if (entry.isDirectory?.()) {
                await this.loadAll(full);
            }
            else if (typeof entry === 'string' ? entry.endsWith('mcp-config.json') : entry.name?.endsWith?.('mcp-config.json')) {
                try {
                    const raw = await fs.readFile(full, 'utf-8');
                    const json = JSON.parse(raw);
                    const name = Object.keys(json)[0];
                    this.services.set(name, {
                        name,
                        configPath: full,
                        config: json[name]
                    });
                }
                catch {
                    // ignore broken json
                }
            }
        }
    }
    list() {
        return Array.from(this.services.keys()).map(name => ({
            name,
            running: this.procs.has(name)
        }));
    }
    /** 启动服务并建立客户端连接 */
    async start(name) {
        const svc = this.services.get(name);
        if (!svc)
            throw new Error(`服务未找到: ${name}`);
        if (this.procs.has(name))
            return; // already running
        // 建立 MCP client（createMCPClient 内部会启动进程）
        const client = await (0, mcp_client_js_1.createMCPClient)(svc.config.command, svc.config.args, {
            ...svc.config.env,
            // 确保工作目录正确
            cwd: svc.config.cwd || path_1.default.dirname(svc.configPath)
        });
        this.clients.set(name, client);
        // 标记服务为运行中（虽然没有保存进程引用，但客户端存在即表示运行中）
        this.procs.set(name, {}); // 占位符，表示服务运行中
    }
    /** 停止服务并关闭客户端 */
    async stop(name) {
        const proc = this.procs.get(name);
        if (proc) {
            // 如果是真实的进程对象，调用 kill
            if (proc.kill && typeof proc.kill === 'function') {
                proc.kill();
            }
            this.procs.delete(name);
        }
        const client = this.clients.get(name);
        if (client) {
            await client.close?.().catch(() => { });
            this.clients.delete(name);
        }
    }
    /** 调用指定服务的工具 */
    async call(name, tool, args) {
        if (!this.clients.has(name)) {
            await this.start(name);
        }
        const client = this.clients.get(name);
        if (!client)
            throw new Error(`未连接到服务: ${name}`);
        return client.callTool({ name: tool, arguments: args });
    }
}
exports.ServiceManager = ServiceManager;
//# sourceMappingURL=service-manager.js.map