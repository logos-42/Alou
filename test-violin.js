const { handleUserNeed } = require('./dist/index.js');

async function test() {
  console.log('测试小提琴学习工具...\n');
  
  try {
    const result = await handleUserNeed('我想要一个可以帮我学小提琴的工具');
    console.log('\n处理结果:');
    console.log(result);
  } catch (error) {
    console.error('测试失败:', error);
  }
}

test().catch(console.error); 