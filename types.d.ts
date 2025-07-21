// Node.js 类型声明
declare namespace NodeJS {
  interface Timeout {
    hasRef(): boolean;
    ref(): this;
    refresh(): this;
    unref(): this;
  }

  interface Process {
    env: Record<string, string>;
    cwd(): string;
    argv: string[];
    exit(code?: number): void;
    stdout: {
      write(chunk: string): boolean;
    };
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

declare const process: NodeJS.Process;

// 动态导入的模块声明
declare module 'dotenv' {
  interface DotenvConfigOutput {
    error?: Error;
    parsed?: Record<string, string>;
  }
  
  export function config(options?: any): DotenvConfigOutput;
}

declare module 'openai' {
  interface Message {
    role: string;
    content: string;
  }
  
  interface ChatCompletion {
    choices: Array<{
      message: Message;
    }>;
  }
  
  interface ChatCompletionCreateOptions {
    model: string;
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
  }
  
  class OpenAI {
    constructor(options: { baseURL?: string; apiKey: string });
    
    chat: {
      completions: {
        create(options: ChatCompletionCreateOptions, extra?: any): Promise<ChatCompletion>;
      };
    };
  }
  
  export default OpenAI;
}

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding?: string): string;
  export function writeFileSync(path: string, data: string): void;
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
}

declare module 'child_process' {
  export function execSync(command: string, options?: any): Buffer;
} 

// 对话历史条目类型
export interface HistoryEntry {
  source: 'user' | 'system' | 'error' | 'ai_thought' | 'memory';
  content: string;
  timestamp: number;
  metadata?: {
    action?: string;
    result?: 'success' | 'error' | 'pending';
    tools_used?: string[];
    confidence?: number;
  };
}

// AI决策行动类型
export interface AIOrchestratorAction {
  thought: string;
  action: 'analyze_need' | 'search_services' | 'decide_from_search_results' | 'install_server' | 'diagnose_error' | 'create_server' | 'respond_to_user' | 'retry' | 'query_memory' | 'use_installed_mcp';
  parameters: any;
  confidence: number;
  next_step_preview?: string;
}

// 记忆查询结果类型
export interface MemoryQueryResult {
  content: any[];
  summary?: string;
  relevance_score?: number;
} 