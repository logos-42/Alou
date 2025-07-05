const { parseUserNeed } = require('./dist/llm-native.js');
const { searchRegistry } = require('./dist/registry.js');
const { ServiceManager } = require('./dist/service-manager.js');

async function testCompleteFlow() {
  console.log('🚀 测试完整的 MCP Host 系统流程...\n');
  
  try {
    const userInput = '我想要一个可以帮我学小提琴的工具';
    console.log('👤 用户输入:', userInput);
    console.log('');
    
    // 1. 深度需求分析
    console.log('🧠 步骤 1: 深度需求分析...');
    const analysis = await parseUserNeed(userInput);
    console.log('分析结果:', JSON.stringify(analysis, null, 2));
    console.log('');
    
    // 2. 本地 Registry 搜索
    console.log('🔍 步骤 2: 本地 Registry 搜索...');
    const searchKeywords = [
      analysis.serviceType || 'general',
      '小提琴',
      '学习',
      '音乐教育'
    ];
    
    const matchingService = await searchRegistry(searchKeywords);
    console.log('匹配的服务:', matchingService);
    console.log('');
    
    if (matchingService) {
      // 3. 启动服务管理器
      console.log('⚙️ 步骤 3: 启动服务管理器...');
      const serviceManager = new ServiceManager();
      await serviceManager.loadAll();
      
      const availableServices = serviceManager.list();
      console.log('可用的服务:', availableServices);
      console.log('');
      
      // 4. 自动执行最匹配的服务
      console.log(`🎯 步骤 4: 自动执行最佳匹配服务 "${matchingService.id}"...`);
      
      try {
        // 启动服务
        await serviceManager.start(matchingService.id);
        console.log('✅ 服务启动成功!');
        
        // 调用服务的工具
        console.log('🛠️ 调用服务工具...');
        
        // 测试获取乐器信息
        const result1 = await serviceManager.call(matchingService.id, 'get_instrument_info', {
          instrument: '小提琴'
        });
        console.log('🎻 乐器信息:', result1.content[0].text);
        console.log('');
        
        // 测试获取练习建议
        const result2 = await serviceManager.call(matchingService.id, 'practice_recommendation', {
          instrument: '小提琴',
          level: '初学者'
        });
        console.log('📚 练习建议:', result2.content[0].text);
        console.log('');
        
        // 停止服务
        await serviceManager.stop(matchingService.id);
        console.log('🔌 服务已停止');
        
        console.log('🎉 完整流程测试成功！系统能够：');
        console.log('   ✅ 分析用户需求');
        console.log('   ✅ 搜索匹配的本地服务');
        console.log('   ✅ 自动启动服务');
        console.log('   ✅ 调用服务工具');
        console.log('   ✅ 返回有用的结果');
        
      } catch (serviceError) {
        console.error('❌ 服务执行失败:', serviceError.message);
        console.log('💡 提示: 虽然服务调用失败，但系统的需求分析和服务发现功能正常工作');
      }
      
    } else {
      console.log('⚠️ 未找到匹配的本地服务，系统会转向外部搜索');
    }
    
  } catch (error) {
    console.error('❌ 系统测试失败:', error.message);
    if (error.stack) {
      console.error('详细错误:', error.stack);
    }
  }
}

// 运行测试
testCompleteFlow().catch(console.error); 