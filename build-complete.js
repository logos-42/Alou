#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 构建 MCP Host 完整版本...');

// 1. 编译 TypeScript
console.log('📝 编译 TypeScript...');
try {
  execSync('npm run compile', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ TypeScript 编译失败:', error.message);
  process.exit(1);
}

// 2. 修复编译后的导入路径
console.log('🔧 修复模块导入路径...');
const filesToFix = [
  'dist/mcp-client.js',
  'dist/templates/mcp-service-template.js'
];

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // 移除 .js 扩展名
    content = content.replace(/require\("@modelcontextprotocol\/sdk\/([^"]+)\.js"\)/g, 
                             'require("@modelcontextprotocol/sdk/$1")');
    fs.writeFileSync(file, content);
    console.log(`  ✓ ${file}`);
  }
});

// 3. 创建构建配置
console.log('📦 创建构建配置...');
const buildConfig = {
  name: "mcp-host-cli",
  version: "1.0.0",
  bin: "dist/cli.js",
  main: "dist/cli.js",
  pkg: {
    scripts: [
      "dist/**/*.js"
    ],
    assets: [
      "node_modules/@modelcontextprotocol/sdk/**/*.js",
      "node_modules/@modelcontextprotocol/sdk/**/*.json"
    ],
    targets: ["node18-win-x64"],
    outputPath: "."
  }
};

fs.writeFileSync('build-config.json', JSON.stringify(buildConfig, null, 2));

// 4. 执行打包
console.log('🚀 开始打包...');
try {
  execSync('npx pkg build-config.json --target node18-win-x64 --output mcp-host.exe --public', {
    stdio: 'inherit'
  });
  
  console.log('✅ 打包成功！');
  
  // 5. 清理临时文件
  fs.unlinkSync('build-config.json');
  
  // 6. 检查输出文件
  if (fs.existsSync('mcp-host.exe')) {
    const stats = fs.statSync('mcp-host.exe');
    console.log(`📄 输出文件: mcp-host.exe`);
    console.log(`📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // 7. 创建分发包
    console.log('📦 创建分发包...');
    const distDir = 'dist-package';
    
    // 创建分发目录
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    // 复制可执行文件
    fs.copyFileSync('mcp-host.exe', path.join(distDir, 'mcp-host.exe'));
    
    // 创建示例 .env 文件
    const envExample = `# LLM 配置
LLM_API_KEY=your-api-key-here
LLM_API_URL=https://api.deepseek.com/chat/completions
LLM_MODEL=deepseek-chat
`;
    fs.writeFileSync(path.join(distDir, '.env'), envExample);
    
    // 创建简单的 README
    const readme = `# MCP Host CLI

## 使用方法

1. 编辑 .env 文件，填入你的 API 密钥
2. 运行命令：
   - 搜索服务: mcp-host.exe "搜索天气服务"
   - 创建服务: mcp-host.exe "创建翻译服务"
   - 启动 Web 服务器: mcp-host.exe --server

## 注意事项
- 确保 .env 文件和 mcp-host.exe 在同一目录
- Windows 可能会有安全警告，请选择"仍然运行"
`;
    fs.writeFileSync(path.join(distDir, 'README.txt'), readme);
    
    console.log(`✅ 分发包创建完成: ${distDir}/`);
    console.log('📋 包含文件:');
    console.log('  - mcp-host.exe (可执行文件)');
    console.log('  - .env (配置文件)');
    console.log('  - README.txt (使用说明)');
  }
} catch (error) {
  console.error('❌ 打包失败:', error.message);
  
  // 清理临时文件
  if (fs.existsSync('build-config.json')) {
    fs.unlinkSync('build-config.json');
  }
  
  process.exit(1);
}

console.log('\n🎉 构建完成！');
console.log('💡 提示: 运行 mcp-host.exe 前请先编辑 dist-package/.env 文件'); 