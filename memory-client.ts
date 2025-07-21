// 简化版 Memory 客户端，专注于基本记忆功能
interface MemoryEntry {
  type: 'service_install' | 'service_call' | 'user_intent' | 'service_relation';
  serviceId?: string;
  timestamp: number;
  content: string;
  metadata: any;
}

interface ServiceRecommendation {
  serviceId: string;
  confidence: number;
  reason: string;
  lastUsed?: number;
}

export class MemoryClient {
  private memoryCache = new Map<string, MemoryEntry>();
  private ready = true;

  constructor() {
    console.log('🧠 初始化简化版Memory客户端...');
  }

  /**
   * 记录服务安装事件
   */
  async recordServiceInstall(serviceId: string, config: any, success: boolean, error?: string) {
    const content = `Service ${serviceId} installation ${success ? 'succeeded' : 'failed'}${error ? ': ' + error : ''}`;
    const tags = ['service_install', serviceId, success ? 'success' : 'failed'];
    
    await this.storeMemory(content, tags, {
      type: 'service_install',
      serviceId,
      config,
      success,
      error,
      timestamp: Date.now()
    });
  }

  /**
   * 记录服务调用事件
   */
  async recordServiceCall(serviceId: string, tool: string, args: any, result: any, success: boolean) {
    const content = `${serviceId}.${tool}(${JSON.stringify(args)}) -> ${success ? 'SUCCESS' : 'FAILED'}`;
    const tags = [serviceId, tool, success ? 'success' : 'failed', 'service_call'];
    
    await this.storeMemory(content, tags, {
      type: 'service_call',
      serviceId,
      tool,
      args,
      result,
      success,
      timestamp: Date.now()
    });
  }

  /**
   * 记录用户意图和服务选择
   */
  async recordUserIntent(userQuery: string, selectedService: string, satisfaction?: number) {
    const content = `User query: "${userQuery}" -> Selected service: ${selectedService}`;
    const tags = ['user_intent', selectedService, ...userQuery.split(' ').slice(0, 3)];
    
    await this.storeMemory(content, tags, {
      type: 'user_intent',
      userQuery,
      selectedService,
      satisfaction,
      timestamp: Date.now()
    });
  }

  /**
   * 智能推荐服务
   */
  async recommendServices(userQuery: string, limit: number = 3): Promise<ServiceRecommendation[]> {
    const recommendations: ServiceRecommendation[] = [];
    
    // 从内存缓存中查找相关服务
    for (const [key, memory] of this.memoryCache) {
      if (memory.type === 'user_intent' && 
          memory.content.toLowerCase().includes(userQuery.toLowerCase())) {
        recommendations.push({
          serviceId: memory.metadata.selectedService,
          confidence: 0.8,
          reason: 'Similar previous query',
          lastUsed: memory.timestamp
        });
      }
      
      if (memory.type === 'service_call' && 
          memory.metadata.success &&
          memory.content.toLowerCase().includes(userQuery.toLowerCase())) {
        recommendations.push({
          serviceId: memory.metadata.serviceId,
          confidence: 0.6,
          reason: 'Previous successful call',
          lastUsed: memory.timestamp
        });
      }
    }
    
    // 去重并排序
    const uniqueRecommendations = recommendations
      .filter((rec, index, self) => 
        index === self.findIndex(r => r.serviceId === rec.serviceId))
      .sort((a, b) => b.confidence - a.confidence);
    
    return uniqueRecommendations.slice(0, limit);
  }

  /**
   * 检查服务是否已安装
   */
  async isServiceInstalled(serviceId: string): Promise<boolean> {
    for (const [key, memory] of this.memoryCache) {
      if (memory.type === 'service_install' && 
          memory.metadata.serviceId === serviceId &&
          memory.metadata.success) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取服务使用统计
   */
  async getServiceStats(serviceId: string) {
    const serviceCalls = Array.from(this.memoryCache.values())
      .filter(memory => memory.type === 'service_call' && memory.metadata.serviceId === serviceId);
    
    if (serviceCalls.length === 0) return null;
    
    const totalCalls = serviceCalls.length;
    const successCalls = serviceCalls.filter(call => call.metadata.success).length;
    const lastUsed = Math.max(...serviceCalls.map(call => call.timestamp));

    return {
      totalCalls,
      successCalls,
      successRate: totalCalls > 0 ? successCalls / totalCalls : 0,
      lastUsed: lastUsed > 0 ? new Date(lastUsed) : null
    };
  }

  /**
   * 学习服务关系
   */
  async learnServiceRelations(services: string[], context: string) {
    const content = `Services used together: ${services.join(', ')} in context: ${context}`;
    const tags = ['service_relation', ...services, context];
    
    await this.storeMemory(content, tags, {
      type: 'service_relation',
      services,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * 清理过期记忆
   */
  async cleanupOldMemories(daysOld: number = 30) {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    
    for (const [key, memory] of this.memoryCache) {
      if (memory.timestamp < cutoffTime && memory.type === 'service_call') {
        this.memoryCache.delete(key);
      }
    }
  }

  // === 私有辅助方法 ===

  private async storeMemory(content: string, tags: string[], metadata: any) {
    const key = `memory_${Date.now()}_${Math.random()}`;
    const entry: MemoryEntry = {
      type: metadata.type,
      serviceId: metadata.serviceId,
      timestamp: metadata.timestamp || Date.now(),
      content,
      metadata: { tags, ...metadata }
    };
    
    this.memoryCache.set(key, entry);
    console.log(`💾 存储记忆: ${content.substring(0, 50)}...`);
  }

  // === 标准MCP接口方法 ===
  
  /**
   * 存储记忆
   */
  async store(data: { content: string; metadata?: any }): Promise<void> {
    const key = `memory_${Date.now()}_${Math.random()}`;
    const entry: MemoryEntry = {
      type: 'user_intent', // 默认类型
      timestamp: Date.now(),
      content: data.content,
      metadata: data.metadata || {}
    };
    
    this.memoryCache.set(key, entry);
  }

  /**
   * 检索记忆
   */
  async retrieve(data: { query: string; n_results?: number }): Promise<any[]> {
    const results = [];
    const query = data.query.toLowerCase();
    
    for (const [key, memory] of this.memoryCache) {
      if (memory.content.toLowerCase().includes(query)) {
        results.push(memory);
      }
    }
    
    return results.slice(0, data.n_results || 5);
  }

  /**
   * 按标签搜索记忆
   */
  async search_by_tag(data: { tags: string[] }): Promise<any[]> {
    const results = [];
    
    for (const [key, memory] of this.memoryCache) {
      if (memory.metadata.tags && 
          data.tags.some(tag => memory.metadata.tags.includes(tag))) {
        results.push(memory);
      }
    }
    
    return results;
  }

  /**
   * 清理重复的记忆
   */
  async cleanup_duplicates(): Promise<void> {
    const contentMap = new Map<string, string>();
    const toDelete = [];
    
    for (const [key, memory] of this.memoryCache) {
      const existing = contentMap.get(memory.content);
      if (existing) {
        toDelete.push(key);
      } else {
        contentMap.set(memory.content, key);
      }
    }
    
    toDelete.forEach(key => this.memoryCache.delete(key));
  }

  // === 兼容性方法 ===
  
  async write(payload: any) {
    await this.recordServiceCall(
      payload.serviceId,
      payload.tool,
      payload.args,
      payload.result,
      payload.ok
    );
  }

  async query(payload: any): Promise<any | null> {
    const recommendations = await this.recommendServices(
      `${payload.serviceId} ${payload.userInput || ''}`.trim()
    );
    
    return recommendations.length > 0 ? {
      serviceId: recommendations[0].serviceId,
      confidence: recommendations[0].confidence,
      reason: recommendations[0].reason
    } : null;
  }
} 