import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 美食数据模型
interface FoodItem {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  description: string;
  imageUrl?: string;
}

// 实用工具：评分计算器
class RatingCalculator {
  static calculateAverage(ratings: number[]): number {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((a, b) => a + b, 0);
    return parseFloat((sum / ratings.length).toFixed(1));
  }
}

// 示例美食数据
const sampleFoodData: FoodItem[] = [
  {
    id: '1',
    name: '意大利面',
    category: '西餐',
    price: 68,
    rating: 4.5,
    description: '经典番茄酱意大利面，配新鲜罗勒叶',
    imageUrl: 'https://example.com/pasta.jpg'
  },
  {
    id: '2',
    name: '宫保鸡丁',
    category: '中餐',
    price: 42,
    rating: 4.8,
    description: '传统川菜，麻辣鲜香',
    imageUrl: 'https://example.com/kungpao.jpg'
  },
  {
    id: '3',
    name: '寿司拼盘',
    category: '日料',
    price: 98,
    rating: 4.7,
    description: '新鲜三文鱼、金枪鱼和甜虾寿司组合'
  }
];

class FoodService {
  private foodItems: FoodItem[] = sampleFoodData;

  async listFoodItems(category?: string): Promise<FoodItem[]> {
    if (category) {
      return this.foodItems.filter(item => item.category === category);
    }
    return this.foodItems;
  }

  async getFoodItem(id: string): Promise<FoodItem | undefined> {
    return this.foodItems.find(item => item.id === id);
  }

  async addRating(itemId: string, newRating: number): Promise<number> {
    const item = this.foodItems.find(f => f.id === itemId);
    if (!item) throw new Error('Food item not found');

    // 模拟用户评分更新
    const newAverage = RatingCalculator.calculateAverage([item.rating, newRating]);
    item.rating = newAverage;
    return newAverage;
  }
}

const transport = new StdioServerTransport();
const server = new Server(transport);

const foodService = new FoodService();

server.register('food.list', async (params: { category?: string }) => {
  return foodService.listFoodItems(params.category);
});

server.register('food.get', async (params: { id: string }) => {
  return foodService.getFoodItem(params.id);
});

server.register('food.rate', async (params: { itemId: string, rating: number }) => {
  return foodService.addRating(params.itemId, params.rating);
});

server.serve();


if __name__ == "__main__":
    mcp.run()