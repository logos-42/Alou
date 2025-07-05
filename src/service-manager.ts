import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { createMCPClient } from './mcp-client.js';

export interface RegisteredService {
  name: string;
  configPath: string;
  config: {
    command: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
  };
}

export class ServiceManager {
  private services = new Map<string, RegisteredService>();
  private procs = new Map<string, ChildProcess>();
  private clients = new Map<string, any>();

  /** 递归扫描 mcp-services 目录，加载所有 mcp-config.json */
  async loadAll(dir: string = path.join(process.cwd(), 'mcp-services')): Promise<void> {
    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, (entry as any).name || entry);
      if ((entry as any).isDirectory?.()) {
        await this.loadAll(full);
      } else if (typeof entry === 'string' ? entry.endsWith('mcp-config.json') : (entry as any).name?.endsWith?.('mcp-config.json')) {
        try {
          const raw = await fs.readFile(full, 'utf-8');
          const json = JSON.parse(raw);
          const name = Object.keys(json)[0];
          this.services.set(name, {
            name,
            configPath: full,
            config: json[name]
          });
        } catch {
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
  async start(name: string): Promise<void> {
    const svc = this.services.get(name);
    if (!svc) throw new Error(`服务未找到: ${name}`);
    if (this.procs.has(name)) return; // already running

    const proc = spawn(
      svc.config.command,
      svc.config.args,
      {
        cwd: svc.config.cwd || path.dirname(svc.configPath),
        env: { ...process.env, ...svc.config.env },
        shell: true,
        stdio: 'inherit'
      }
    );
    this.procs.set(name, proc);

    proc.on('exit', () => {
      this.procs.delete(name);
      const client = this.clients.get(name);
      client?.close?.().catch(() => {});
      this.clients.delete(name);
    });

    // 建立 MCP client
    const client = await createMCPClient(
      svc.config.command, 
      svc.config.args, 
      {
        ...svc.config.env,
        // 确保工作目录正确
        cwd: svc.config.cwd || path.dirname(svc.configPath)
      }
    );
    this.clients.set(name, client);
  }

  /** 停止服务并关闭客户端 */
  async stop(name: string): Promise<void> {
    const proc = this.procs.get(name);
    if (proc) {
      proc.kill();
      this.procs.delete(name);
    }
    const client = this.clients.get(name);
    if (client) {
      await client.close?.().catch(() => {});
      this.clients.delete(name);
    }
  }

  /** 调用指定服务的工具 */
  async call(name: string, tool: string, args: any): Promise<any> {
    if (!this.clients.has(name)) {
      await this.start(name);
    }
    const client = this.clients.get(name);
    if (!client) throw new Error(`未连接到服务: ${name}`);
    return client.callTool({ name: tool, arguments: args });
  }
} 