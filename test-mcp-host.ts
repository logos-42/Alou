import { handleUserNeed } from './src/index.js';

// 测试用例
const testCases = [
  "我需要一个天气查询服务",
  "帮我创建一个翻译工具",
  "我想要一个能查询股票价格的服务",
  "创建一个数据库查询工具"
];

async function runTests() {
  console.log('🧪 开始测试 MCP Host...\n');
  
  for (const testCase of testCases) {
    console.log('━'.repeat(50));
    console.log(`📝 测试用例: "${testCase}"`);
    console.log('━'.repeat(50));
    
    try {
      const result = await handleUserNeed(testCase);
      console.log(result);
    } catch (error) {
      console.error('❌ 测试失败:', error);
    }
    
    console.log('\n');
  }
}

// 注意：运行此测试需要配置有效的 LLM API Key
console.log(`
⚠️  注意事项：
1. 请先在 .env 文件中配置你的 LLM API Key
2. 确保网络连接正常
3. 此测试会实际调用 LLM API，可能产生费用
`);

// 如果提供了 API Key 参数，则运行测试
if (process.argv[2] === '--run') {
  runTests().catch(console.error);
} else {
  console.log('使用 "tsx test-mcp-host.ts --run" 来运行测试');
} 