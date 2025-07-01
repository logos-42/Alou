# 测试 DeepSeek API
$apiKey = "sk-392a95fc7d2445f6b6c79c17725192d1"
$url = "https://api.deepseek.com/chat/completions"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $apiKey"
}

$body = @{
    model = "deepseek-chat"
    messages = @(
        @{
            role = "system"
            content = "You are a helpful assistant."
        },
        @{
            role = "user"
            content = "Hello! Please reply with 'API test successful'"
        }
    )
    stream = $false
} | ConvertTo-Json -Depth 10

Write-Host "🧪 测试 DeepSeek API..." -ForegroundColor Cyan
Write-Host "📍 URL: $url" -ForegroundColor Gray
Write-Host "📦 模型: deepseek-chat" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -TimeoutSec 30
    Write-Host "✅ API 连接成功！" -ForegroundColor Green
    Write-Host "📝 响应: $($response.choices[0].message.content)" -ForegroundColor Yellow
} catch {
    Write-Host "❌ API 连接失败！" -ForegroundColor Red
    Write-Host "错误: $_" -ForegroundColor Red
} 