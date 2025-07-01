Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "测试MCP服务修复情况" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# 获取所有的MCP服务目录
$services = @(
    "mcp-translation-1751378299521",
    "mcp-video-1751377806732", 
    "mcp-weather-1751377939147"
)

foreach ($service in $services) {
    Write-Host "`n测试服务: $service" -ForegroundColor Yellow
    
    $servicePath = "mcp-services/$service"
    
    if (Test-Path $servicePath) {
        Write-Host "✓ 服务目录存在" -ForegroundColor Green
        
        # 检查package.json
        if (Test-Path "$servicePath/package.json") {
            Write-Host "✓ package.json 存在" -ForegroundColor Green
        } else {
            Write-Host "✗ package.json 缺失" -ForegroundColor Red
        }
        
        # 检查index.ts
        if (Test-Path "$servicePath/index.ts") {
            Write-Host "✓ index.ts 存在" -ForegroundColor Green
            
            # 检查是否包含正确的import
            $content = Get-Content "$servicePath/index.ts" -Raw
            if ($content -match "@modelcontextprotocol/sdk/server/index.js") {
                Write-Host "✓ 使用正确的SDK导入" -ForegroundColor Green
            } else {
                Write-Host "✗ SDK导入不正确" -ForegroundColor Red
            }
            
            # 检查是否有Python代码混入
            if ($content -match "__name__" -or $content -match "mcp\.run\(\)") {
                Write-Host "✗ 检测到Python代码混入" -ForegroundColor Red
            } else {
                Write-Host "✓ 没有Python代码混入" -ForegroundColor Green
            }
        } else {
            Write-Host "✗ index.ts 缺失" -ForegroundColor Red
        }
        
        # 尝试编译
        Write-Host "  尝试编译..." -ForegroundColor Gray
        Push-Location $servicePath
        try {
            $compileResult = & npx tsc 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ 编译成功" -ForegroundColor Green
                
                # 检查dist目录
                if (Test-Path "dist/index.js") {
                    Write-Host "✓ dist/index.js 已生成" -ForegroundColor Green
                } else {
                    Write-Host "✗ dist/index.js 未生成" -ForegroundColor Red
                }
            } else {
                Write-Host "✗ 编译失败" -ForegroundColor Red
                Write-Host $compileResult -ForegroundColor Red
            }
        } catch {
            Write-Host "✗ 编译过程出错: $_" -ForegroundColor Red
        } finally {
            Pop-Location
        }
        
    } else {
        Write-Host "✗ 服务目录不存在" -ForegroundColor Red
    }
}

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "测试完成" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan 