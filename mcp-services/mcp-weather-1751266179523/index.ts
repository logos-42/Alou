```typescript
import { McpSDK, Service, Tool, ToolContext } from '@modelcontextprotocol/sdk';

// 定义天气查询工具
class WeatherQueryTool extends Tool {
  name = 'weather_query';
  description = '查询当前天气情况';
  parameters = {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: '城市或地区名称'
      }
    },
    required: ['location']
  };

  async execute(args: { location: string }, context: ToolContext): Promise<any> {
    // 这里应该是实际的天气API调用
    // 示例中返回模拟数据
    return {
      location: args.location,
      temperature: '22°C',
      condition: '晴天',
      humidity: '65%',
      wind: '10km/h'
    };
  }
}

// 定义天气预报工具
class WeatherForecastTool extends Tool {
  name = 'weather_forecast';
  description = '查询天气预报';
  parameters = {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: '城市或地区名称'
      },
      days: {
        type: 'number',
        description: '预报天数',
        default: 3
      }
    },
    required: ['location']
  };

  async execute(args: { location: string; days?: number }, context: ToolContext): Promise<any> {
    // 这里应该是实际的天气API调用
    // 示例中返回模拟数据
    const forecast = [];
    for (let i = 0; i < (args.days || 3); i++) {
      forecast.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        temperature: `${20 + i}°C`,
        condition: i % 2 === 0 ? '晴天' : '多云'
      });
    }
    return {
      location: args.location,
      forecast
    };
  }
}

// 创建天气服务
class WeatherService extends Service {
  name = 'weather_service';
  description = '提供天气查询和预报服务';
  tools = [new WeatherQueryTool(), new WeatherForecastTool()];
}

// 初始化并运行服务
(async () => {
  const mcp = new McpSDK({
    serviceType: 'weather',
    service: new WeatherService()
  });

  await mcp.start();
  console.log('Weather service started');
})();
```