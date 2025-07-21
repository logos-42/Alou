import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface MemoryItem {
  id: string;
  content: string;
  metadata?: {
    tags?: string[];
    type?: string;
    [key: string]: any;
  };
  timestamp: number;
  content_hash: string;
}

export interface MemorySearchResult {
  memories: MemoryItem[];
  total: number;
}

export class EmbeddedMemoryService {
  private memoryFile: string;
  private memories: Map<string, MemoryItem> = new Map();
  private isInitialized = false;

  constructor(dataDir?: string) {
    // PKG环境下使用exe所在目录，否则使用当前目录
    const appRoot = this.getAppRoot();
    const memoryDir = dataDir || path.join(appRoot, '.alou-memory');
    
    // 确保目录存在
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    
    this.memoryFile = path.join(memoryDir, 'memories.json');
    this.loadMemories();
  }

  private getAppRoot(): string {
    // @ts-ignore - PKG环境检测
    if (typeof process.pkg !== 'undefined') {
      // PKG环境下，使用exe文件所在目录
      return path.dirname(process.execPath);
    } else {
      // 开发环境
      return process.cwd();
    }
  }

  private generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private loadMemories(): void {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const data = fs.readFileSync(this.memoryFile, 'utf-8');
        const memoriesArray: MemoryItem[] = JSON.parse(data);
        
        this.memories.clear();
        memoriesArray.forEach(memory => {
          this.memories.set(memory.id, memory);
        });
        
        // 减少输出，只在有记忆时显示简单信息
        if (this.memories.size > 0) {
        console.log(`✅ 加载了 ${this.memories.size} 个内置记忆`);
        }
      }
      this.isInitialized = true;
    } catch (error) {
      // 静默处理错误
      this.memories.clear();
      this.isInitialized = true;
    }
  }

  private saveMemories(): void {
    try {
      const memoriesArray = Array.from(this.memories.values());
      fs.writeFileSync(this.memoryFile, JSON.stringify(memoriesArray, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ 保存记忆数据失败:', error);
    }
  }

  /**
   * 存储记忆
   */
  async storeMemory(content: string, metadata?: any): Promise<{ success: boolean; id: string }> {
    try {
      const id = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const contentHash = this.generateContentHash(content);
      
      // 检查是否已存在相同内容
      const existing = Array.from(this.memories.values()).find(m => m.content_hash === contentHash);
      if (existing) {
        return { success: true, id: existing.id };
      }

      const memory: MemoryItem = {
        id,
        content,
        metadata: metadata || {},
        timestamp: Date.now(),
        content_hash: contentHash
      };

      this.memories.set(id, memory);
      this.saveMemories();

      return { success: true, id };
    } catch (error) {
      console.error('❌ 存储记忆失败:', error);
      return { success: false, id: '' };
    }
  }

  /**
   * 检索记忆 (简单文本搜索)
   */
  async retrieveMemory(query: string, nResults: number = 5): Promise<MemorySearchResult> {
    try {
      const queryLower = query.toLowerCase();
      const results: MemoryItem[] = [];

      for (const memory of this.memories.values()) {
        const contentMatch = memory.content.toLowerCase().includes(queryLower);
        const tagMatch = memory.metadata?.tags?.some(tag => 
          tag.toLowerCase().includes(queryLower)
        ) || false;
        const typeMatch = memory.metadata?.type?.toLowerCase().includes(queryLower) || false;

        if (contentMatch || tagMatch || typeMatch) {
          results.push(memory);
        }
      }

      // 按时间排序，最新的在前
      results.sort((a, b) => b.timestamp - a.timestamp);

      return {
        memories: results.slice(0, nResults),
        total: results.length
      };
    } catch (error) {
      console.error('❌ 检索记忆失败:', error);
      return { memories: [], total: 0 };
    }
  }

  /**
   * 按标签搜索
   */
  async searchByTag(tags: string[], nResults: number = 5): Promise<MemorySearchResult> {
    try {
      const results: MemoryItem[] = [];

      for (const memory of this.memories.values()) {
        const memoryTags = memory.metadata?.tags || [];
        const hasMatchingTag = tags.some(tag => 
          memoryTags.some(memoryTag => 
            memoryTag.toLowerCase().includes(tag.toLowerCase())
          )
        );

        if (hasMatchingTag) {
          results.push(memory);
        }
      }

      // 按时间排序
      results.sort((a, b) => b.timestamp - a.timestamp);

      return {
        memories: results.slice(0, nResults),
        total: results.length
      };
    } catch (error) {
      console.error('❌ 标签搜索失败:', error);
      return { memories: [], total: 0 };
    }
  }

  /**
   * 时间召回
   */
  async recallMemory(query: string, nResults: number = 5): Promise<MemorySearchResult> {
    try {
      const timeFrame = this.parseTimeFrame(query);
      const results: MemoryItem[] = [];

      for (const memory of this.memories.values()) {
        const inTimeFrame = timeFrame ? 
          (memory.timestamp >= timeFrame.start && memory.timestamp <= timeFrame.end) : true;

        if (inTimeFrame) {
          // 如果有具体查询词，还要匹配内容
          if (query && !this.isTimeExpression(query)) {
            const queryLower = query.toLowerCase();
            const contentMatch = memory.content.toLowerCase().includes(queryLower);
            if (!contentMatch) continue;
          }
          results.push(memory);
        }
      }

      // 按时间排序
      results.sort((a, b) => b.timestamp - a.timestamp);

      return {
        memories: results.slice(0, nResults),
        total: results.length
      };
    } catch (error) {
      console.error('❌ 时间召回失败:', error);
      return { memories: [], total: 0 };
    }
  }

  /**
   * 删除记忆
   */
  async deleteMemory(contentHash: string): Promise<{ success: boolean }> {
    try {
      let deleted = false;
      for (const [id, memory] of this.memories.entries()) {
        if (memory.content_hash === contentHash) {
          this.memories.delete(id);
          deleted = true;
          break;
        }
      }

      if (deleted) {
        this.saveMemories();
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('❌ 删除记忆失败:', error);
      return { success: false };
    }
  }

  /**
   * 检查数据库健康状况
   */
  async checkDatabaseHealth(): Promise<{
    status: string;
    memory_count: number;
    file_size_mb: number;
    file_path: string;
  }> {
    try {
      let fileSize = 0;
      if (fs.existsSync(this.memoryFile)) {
        const stats = fs.statSync(this.memoryFile);
        fileSize = stats.size / (1024 * 1024); // MB
      }

      return {
        status: this.isInitialized ? 'healthy' : 'error',
        memory_count: this.memories.size,
        file_size_mb: Math.round(fileSize * 100) / 100,
        file_path: this.memoryFile
      };
    } catch (error) {
      console.error('❌ 健康检查失败:', error);
      return {
        status: 'error',
        memory_count: 0,
        file_size_mb: 0,
        file_path: this.memoryFile
      };
    }
  }

  /**
   * 解析时间表达式
   */
  private parseTimeFrame(query: string): { start: number; end: number } | null {
    const now = Date.now();
    const queryLower = query.toLowerCase();

    if (queryLower.includes('昨天') || queryLower.includes('yesterday')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
      return { start: yesterday.getTime(), end: end.getTime() };
    }

    if (queryLower.includes('上周') || queryLower.includes('last week')) {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      return { start: lastWeek.getTime(), end: now };
    }

    if (queryLower.includes('上个月') || queryLower.includes('last month')) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return { start: lastMonth.getTime(), end: now };
    }

    if (queryLower.includes('今天') || queryLower.includes('today')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { start: today.getTime(), end: now };
    }

    // 匹配 "X天前"
    const daysAgoMatch = queryLower.match(/(\d+)天前|(\d+)\s*days?\s*ago/);
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1] || daysAgoMatch[2]);
      const date = new Date();
      date.setDate(date.getDate() - days);
      return { start: date.getTime(), end: now };
    }

    return null;
  }

  /**
   * 判断是否为时间表达式
   */
  private isTimeExpression(query: string): boolean {
    const timeKeywords = [
      '昨天', 'yesterday', '上周', 'last week', '上个月', 'last month',
      '今天', 'today', '天前', 'days ago', '小时前', 'hours ago'
    ];
    
    const queryLower = query.toLowerCase();
    return timeKeywords.some(keyword => queryLower.includes(keyword)) ||
           /\d+\s*(天|小时|分钟|days?|hours?|minutes?)前/.test(queryLower);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total_memories: number;
    unique_tags: number;
    memory_types: Record<string, number>;
    recent_activity: { date: string; count: number }[];
  }> {
    const stats = {
      total_memories: this.memories.size,
      unique_tags: 0,
      memory_types: {} as Record<string, number>,
      recent_activity: [] as { date: string; count: number }[]
    };

    const allTags = new Set<string>();
    const typeCount: Record<string, number> = {};
    const dailyCount: Record<string, number> = {};

    for (const memory of this.memories.values()) {
      // 统计标签
      if (memory.metadata?.tags) {
        memory.metadata.tags.forEach(tag => allTags.add(tag));
      }

      // 统计类型
      const type = memory.metadata?.type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;

      // 统计每日活动
      const date = new Date(memory.timestamp).toISOString().split('T')[0];
      dailyCount[date] = (dailyCount[date] || 0) + 1;
    }

    stats.unique_tags = allTags.size;
    stats.memory_types = typeCount;

    // 最近7天的活动
    const recentDates = Object.keys(dailyCount).sort().slice(-7);
    stats.recent_activity = recentDates.map(date => ({
      date,
      count: dailyCount[date]
    }));

    return stats;
  }
} 