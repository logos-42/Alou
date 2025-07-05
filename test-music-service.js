const { createMCPClient } = require('./dist/mcp-client.js');

async function testMusicService() {
  console.log('🎵 测试音乐学习助手服务...\n');
  
  let client;
  try {
    // 创建客户端连接到音乐学习助手服务
    console.log('📡 连接到音乐学习助手服务...');
    client = await createMCPClient(
      'npx', 
      ['tsx', 'mcp-services/music-learning-assistant/index.ts']
    );
    
    console.log('✅ 连接成功!\n');
    
    // 1. 测试获取工具列表
    console.log('📋 获取工具列表...');
    const toolsResponse = await client.listTools();
    const tools = toolsResponse?.tools || [];
    console.log('可用工具:', Array.isArray(tools) ? tools.map(t => t.name).join(', ') : '无法获取工具列表');
    console.log('');
    
    // 2. 测试获取乐器信息
    console.log('🎻 测试获取小提琴信息...');
    const instrumentInfo = await client.callTool({
      name: 'get_instrument_info',
      arguments: { instrument: '小提琴' }
    });
    console.log('结果:', instrumentInfo.content[0].text);
    console.log('');
    
    // 3. 测试获取音阶信息
    console.log('🎼 测试获取C大调音阶...');
    const scaleInfo = await client.callTool({
      name: 'get_scale_notes',
      arguments: { scale: 'C大调' }
    });
    console.log('结果:', scaleInfo.content[0].text);
    console.log('');
    
    // 4. 测试获取练习建议
    console.log('📚 测试获取小提琴初学者练习建议...');
    const practiceInfo = await client.callTool({
      name: 'practice_recommendation',
      arguments: { instrument: '小提琴', level: '初学者' }
    });
    console.log('结果:', practiceInfo.content[0].text);
    console.log('');
    
    console.log('🎉 所有测试通过！音乐学习助手服务运行正常。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.stack) {
      console.error('详细错误:', error.stack);
    }
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('🔌 客户端连接已关闭');
      } catch (e) {
        console.error('关闭客户端时出错:', e.message);
      }
    }
  }
}

// 运行测试
testMusicService().catch(console.error); 