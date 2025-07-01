#!/usr/bin/env pwsh

Write-Host "🧪 测试 MCP Create 功能" -ForegroundColor Cyan
Write-Host ""

# 测试创建一个服务
$testQuery = "创建一个比特币价格查询服务"
Write-Host "📝 测试查询: '$testQuery'" -ForegroundColor Yellow
Write-Host ""

# 运行测试
& npx tsx src/index.ts $testQuery

Write-Host ""
Write-Host "✅ 测试完成" -ForegroundColor Green 