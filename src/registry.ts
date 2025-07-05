import * as fs from 'fs/promises';
import * as path from 'path';

const registryPath = path.join(process.cwd(), 'mcp-services', 'registry.json');

export interface RegistryRecord {
  id: string;           // server id / name
  service_type: string; // 分类
  title: string;        // 可读标题
  tags: string[];       // 关键词
}

async function readRegistry(): Promise<RegistryRecord[]> {
  try {
    const raw = await fs.readFile(registryPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addRegistry(record: RegistryRecord) {
  const list = await readRegistry();
  // 去重
  if (!list.find(r => r.id === record.id)) {
    list.push(record);
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(registryPath, JSON.stringify(list, null, 2));
  }
}

export async function searchRegistry(queryWords: string[]): Promise<RegistryRecord | null> {
  const list = await readRegistry();
  let best: RegistryRecord | null = null;
  let bestScore = 0;
  for (const rec of list) {
    const text = rec.tags.join(' ').toLowerCase();
    const score = queryWords.filter(w => text.includes(w.toLowerCase())).length;
    if (score > bestScore) {
      best = rec;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
} 