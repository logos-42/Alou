import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'video-recommendation-service',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// 模拟视频数据
const videos = [
  { id: 'v001', title: '美丽风景合集', views: 1200000, duration: '15:30', category: 'travel', rating: 4.8 },
  { id: 'v002', title: '搞笑动物集锦', views: 850000, duration: '8:45', category: 'funny', rating: 4.6 },
  { id: 'v003', title: '美食制作教程', views: 950000, duration: '12:20', category: 'food', rating: 4.7 },
  { id: 'v004', title: '健身训练指南', views: 680000, duration: '20:15', category: 'fitness', rating: 4.5 },
  { id: 'v005', title: '科技产品评测', views: 1100000, duration: '18:40', category: 'tech', rating: 4.9 },
  { id: 'v006', title: '音乐现场表演', views: 920000, duration: '25:00', category: 'music', rating: 4.7 },
  { id: 'v007', title: '游戏攻略合集', views: 1500000, duration: '30:00', category: 'gaming', rating: 4.8 }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'recommend_videos',
        description: '推荐好看的视频',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: '视频分类 (travel, funny, food, fitness, tech, music, gaming)' },
            limit: { type: 'number', default: 5, description: '返回数量 (1-10)' },
            minRating: { type: 'number', default: 4.0, description: '最低评分' }
          }
        }
      },
      {
        name: 'search_videos',
        description: '搜索视频',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '搜索关键词' },
            limit: { type: 'number', default: 5, description: '返回数量' }
          },
          required: ['keyword']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'recommend_videos') {
    if (!request.params.arguments) {
      throw new Error('Missing arguments');
    }
    
    const category = request.params.arguments.category as string;
    const limit = Math.min((request.params.arguments.limit as number) || 5, 10);
    const minRating = (request.params.arguments.minRating as number) || 4.0;
    
    let filtered = videos.filter(v => v.rating >= minRating);
    
    if (category) {
      filtered = filtered.filter(v => v.category === category);
    }
    
    const recommended = filtered
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
    
    if (recommended.length === 0) {
      return {
        content: [{
          type: 'text',
          text: category ? `没有找到分类为 "${category}" 的视频` : '没有找到符合条件的视频'
        }]
      };
    }
    
    const result = recommended.map(v => 
      `📺 ${v.title}\n   ⏱️ ${v.duration} | 👁️ ${v.views.toLocaleString()} 次观看 | ⭐ ${v.rating}`
    ).join('\n\n');
    
    return {
      content: [{
        type: 'text',
        text: `推荐的视频：\n\n${result}`
      }]
    };
  }
  
  if (request.params.name === 'search_videos') {
    if (!request.params.arguments) {
      throw new Error('Missing arguments');
    }
    
    const keyword = (request.params.arguments.keyword as string).toLowerCase();
    const limit = (request.params.arguments.limit as number) || 5;
    
    const searched = videos
      .filter(v => v.title.toLowerCase().includes(keyword))
      .slice(0, limit);
    
    if (searched.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `没有找到包含 "${keyword}" 的视频`
        }]
      };
    }
    
    const result = searched.map(v => 
      `📺 ${v.title}\n   ⏱️ ${v.duration} | 👁️ ${v.views.toLocaleString()} 次观看 | ⭐ ${v.rating}`
    ).join('\n\n');
    
    return {
      content: [{
        type: 'text',
        text: `搜索结果：\n\n${result}`
      }]
    };
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Video recommendation service is running');
}

main().catch(console.error);