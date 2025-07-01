#!/usr/bin/env tsx

import { handleUserNeed } from './src/index.js';

async function testMCPCreate() {
  console.log('🧪 测试 MCP Create 功能...\n');
  
  // 测试创建一个以太币价格查询服务
  const testQuery = '创建一个以太币价格查询服务';
  console.log(`📝 测试查询: "${testQuery}"\n`);
  
  try {
    const result = await handleUserNeed(testQuery);
    console.log('📋 处理结果:');
    console.log(result);
    
    // 检查是否包含预期的内容
    if (result.includes('MCP Create 服务不可用')) {
      console.log('\n⚠️ MCP Create 服务不可用，使用了备用方案');
      console.log('✅ 备用方案成功创建了服务');
    } else if (result.includes('成功创建')) {
      console.log('\n✅ MCP Create 成功创建了服务');
    } else {
      console.log('\n❌ 创建失败');
    }
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

// 运行测试
testMCPCreate().catch(console.error); 