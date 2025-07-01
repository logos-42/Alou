import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 视频推荐服务
class VideoRecommendationService {
    private videos = [
        {
            id: '1',
            title: '精彩电影合集',
            description: '包含今年最受欢迎的电影片段',
            url: 'https://example.com/videos/1',
            thumbnail: 'https://example.com/thumbnails/1.jpg',
            views: 1500000,
            likes: 95000,
            duration: '2:15:30',
            tags: ['电影', '合集', '热门']
        },
        {
            id: '2',
            title: '自然风光纪录片',
            description: '世界各地的美丽自然景观',
            url: 'https://example.com/videos/2',
            thumbnail: 'https://example.com/thumbnails/2.jpg',
            views: 890000,
            likes: 67000,
            duration: '1:30:45',
            tags: ['自然', '风光', '纪录片']
        },
        {
            id: '3',
            title: '搞笑短视频集锦',
            description: '让你笑到停不下来的短视频合集',
            url: 'https://example.com/videos/3',
            thumbnail: 'https://example.com/thumbnails/3.jpg',
            views: 3200000,
            likes: 210000,
            duration: '0:45:20',
            tags: ['搞笑', '短视频', '娱乐']
        }
    ];

    // 实用工具：格式化观看次数
    private formatViews(views: number): string {
        if (views >= 1000000) {
            return `${(views / 1000000).toFixed(1)}M`;
        } else if (views >= 1000) {
            return `${(views / 1000).toFixed(1)}K`;
        }
        return views.toString();
    }

    // 获取热门视频
    async getPopularVideos(limit: number = 5) {
        const sorted = [...this.videos].sort((a, b) => b.views - a.views);
        return sorted.slice(0, limit).map(video => ({
            ...video,
            viewsFormatted: this.formatViews(video.views)
        }));
    }

    // 根据关键词搜索视频
    async searchVideos(keyword: string) {
        const lowerKeyword = keyword.toLowerCase();
        return this.videos.filter(video => 
            video.title.toLowerCase().includes(lowerKeyword) || 
            video.description.toLowerCase().includes(lowerKeyword) ||
            video.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
        ).map(video => ({
            ...video,
            viewsFormatted: this.formatViews(video.views)
        }));
    }

    // 获取视频详情
    async getVideoDetails(id: string) {
        const video = this.videos.find(v => v.id === id);
        if (!video) throw new Error('Video not found');
        return {
            ...video,
            viewsFormatted: this.formatViews(video.views)
        };
    }
}

// 创建MCP服务
const service = new VideoRecommendationService();
const server = new Server(new StdioServerTransport());

server.register('video.recommend', async () => {
    return await service.getPopularVideos();
});

server.register('video.search', async ({ keyword }) => {
    if (!keyword) throw new Error('Keyword is required');
    return await service.searchVideos(keyword);
});

server.register('video.details', async ({ id }) => {
    if (!id) throw new Error('Video ID is required');
    return await service.getVideoDetails(id);
});

server.serve();


if __name__ == "__main__":
    mcp.run()