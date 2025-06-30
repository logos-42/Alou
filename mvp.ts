import { askLLM } from './llm.js';          // 封装的大模型 API
import {
  mcp_mcp-compass_recommend-mcp-servers as compass,
  mcp_mcp-installer_install_repo_mcp_server as installer,
  mcp_mcp-create_create-server-from-template as creator
} from 'mcp-tools-sdk';                     // 假想的官方 SDK 映射

export async function handleNeed(userSentence: string) {
  // 1. 解析需求
  const need = await askLLM(userSentence);  // {service_type, keywords, action}

  // 2. 搜索
  const result = await compass({ query: `${need.service_type} ${need.keywords.join(' ')}` });
  if (result.servers?.length) {
    const best = result.servers[0];
    console.log('⭐️ 使用现成服务: ', best.title);
    await installer({ name: best.title });
    return `已安装 ${best.title}`;
  }

  // 3. 创建
  const code = await askLLM(`生成${need.service_type}最小MCP模板`);
  const srv = await creator({ language: 'typescript', code });
  return `已创建 ${srv.serverId}`;
}