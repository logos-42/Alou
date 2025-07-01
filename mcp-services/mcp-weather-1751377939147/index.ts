import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'weather-service',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// 模拟天气数据
function getWeatherData(location: string, unit: string = 'celsius') {
  const locations: Record<string, any> = {
    '北京': { temp: 15, condition: '晴朗', humidity: 45, windSpeed: 10 },
    '上海': { temp: 18, condition: '多云', humidity: 60, windSpeed: 15 },
    '广州': { temp: 25, condition: '小雨', humidity: 80, windSpeed: 8 },
    '深圳': { temp: 26, condition: '晴朗', humidity: 75, windSpeed: 12 },
    'beijing': { temp: 15, condition: 'Sunny', humidity: 45, windSpeed: 10 },
    'shanghai': { temp: 18, condition: 'Cloudy', humidity: 60, windSpeed: 15 },
    'london': { temp: 12, condition: 'Rainy', humidity: 85, windSpeed: 20 },
    'new york': { temp: 10, condition: 'Partly Cloudy', humidity: 55, windSpeed: 18 }
  };
  
  const data = locations[location.toLowerCase()] || {
    temp: 20 + Math.random() * 10 - 5,
    condition: ['晴朗', '多云', '小雨', '阴天'][Math.floor(Math.random() * 4)],
    humidity: Math.floor(Math.random() * 50) + 30,
    windSpeed: Math.floor(Math.random() * 20) + 5
  };
  
  if (unit === 'fahrenheit') {
    data.temp = data.temp * 9/5 + 32;
  }
  
  return data;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_weather',
        description: '获取指定地点的天气信息',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string', description: '城市名称' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius', description: '温度单位' }
          },
          required: ['location']
        }
      },
      {
        name: 'get_forecast',
        description: '获取未来几天的天气预报',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string', description: '城市名称' },
            days: { type: 'number', default: 3, minimum: 1, maximum: 7, description: '预报天数' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
          },
          required: ['location']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_weather') {
    if (!request.params.arguments) {
      throw new Error('Missing arguments');
    }
    
    const location = request.params.arguments.location as string;
    const unit = (request.params.arguments.unit as string) || 'celsius';
    
    const weather = getWeatherData(location, unit);
    const unitSymbol = unit === 'celsius' ? '°C' : '°F';
    
    return {
      content: [{
        type: 'text',
        text: `${location} 当前天气：
🌡️ 温度: ${weather.temp.toFixed(1)}${unitSymbol}
☁️ 天气: ${weather.condition}
💧 湿度: ${weather.humidity}%
💨 风速: ${weather.windSpeed} km/h`
      }]
    };
  }
  
  if (request.params.name === 'get_forecast') {
    if (!request.params.arguments) {
      throw new Error('Missing arguments');
    }
    
    const location = request.params.arguments.location as string;
    const days = Math.min((request.params.arguments.days as number) || 3, 7);
    const unit = (request.params.arguments.unit as string) || 'celsius';
    const unitSymbol = unit === 'celsius' ? '°C' : '°F';
    
    let forecast = `${location} ${days}天天气预报：\n\n`;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i + 1);
      const dateStr = date.toLocaleDateString('zh-CN');
      
      const baseTemp = unit === 'celsius' ? 20 : 68;
      const maxTemp = baseTemp + Math.random() * 10;
      const minTemp = baseTemp - Math.random() * 5;
      const conditions = ['晴朗', '多云', '小雨', '阴天'];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      
      forecast += `📅 ${dateStr}\n`;
      forecast += `   最高: ${maxTemp.toFixed(1)}${unitSymbol} | 最低: ${minTemp.toFixed(1)}${unitSymbol}\n`;
      forecast += `   天气: ${condition}\n\n`;
    }
    
    return {
      content: [{
        type: 'text',
        text: forecast.trim()
      }]
    };
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Weather service is running');
}

main().catch(console.error);