// 完整测试 MCP Host 系统
process.env.LLM_API_KEY = 'sk-392a95fc7d2445f6b6c79c17725192d1';
process.env.LLM_MODEL = 'deepseek-reasoner';

const { handleUserNeed } = require('./dist/index.js');

async function test() {
  console.log('='.repeat(80));
  console.log('测试 1: 搜索现有服务 - 翻译服务');
  console.log('='.repeat(80));
  
  try {
    const result1 = await handleUserNeed('我需要一个翻译服务来翻译文档');
    console.log(result1);
  } catch (error) {
    console.error('错误:', error.message);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('测试 2: 创建新服务 - 股票分析');
  console.log('='.repeat(80));
  
  try {
    const result2 = await handleUserNeed('我想分析股票市场趋势，请创建一个股票分析助手');
    console.log(result2);
  } catch (error) {
    console.error('错误:', error.message);
  }
}

test().catch(console.error); 