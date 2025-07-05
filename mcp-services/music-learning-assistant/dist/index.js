"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const server = new index_js_1.Server({
    name: 'music-learning-assistant',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {}
    }
});
// 音乐理论知识库
const musicTheory = {
    scales: {
        'C大调': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        'G大调': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
        'D大调': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#']
    },
    instruments: {
        '小提琴': {
            strings: ['G', 'D', 'A', 'E'],
            difficulty: '高',
            tips: '注意弓法和音准，建议从空弦练习开始'
        },
        '钢琴': {
            keys: 88,
            difficulty: '中',
            tips: '注意手型和指法，建议从C大调音阶开始'
        },
        '吉他': {
            strings: ['E', 'A', 'D', 'G', 'B', 'E'],
            difficulty: '中',
            tips: '注意按弦力度，建议从和弦练习开始'
        }
    }
};
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'get_instrument_info',
                description: '获取乐器学习信息和建议',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instrument: {
                            type: 'string',
                            description: '乐器名称，如：小提琴、钢琴、吉他',
                            enum: ['小提琴', '钢琴', '吉他']
                        }
                    },
                    required: ['instrument']
                }
            },
            {
                name: 'get_scale_notes',
                description: '获取音阶的音符组成',
                inputSchema: {
                    type: 'object',
                    properties: {
                        scale: {
                            type: 'string',
                            description: '音阶名称，如：C大调、G大调、D大调',
                            enum: ['C大调', 'G大调', 'D大调']
                        }
                    },
                    required: ['scale']
                }
            },
            {
                name: 'practice_recommendation',
                description: '获取练习建议',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instrument: {
                            type: 'string',
                            description: '乐器名称'
                        },
                        level: {
                            type: 'string',
                            description: '水平：初学者、中级、高级',
                            enum: ['初学者', '中级', '高级'],
                            default: '初学者'
                        }
                    },
                    required: ['instrument']
                }
            }
        ]
    };
});
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // 确保 args 存在
    if (!args) {
        throw new Error('Missing arguments');
    }
    if (name === 'get_instrument_info') {
        const instrument = args.instrument;
        const info = musicTheory.instruments[instrument];
        if (!info) {
            return {
                content: [{
                        type: 'text',
                        text: `抱歉，暂不支持 ${instrument}。目前支持：小提琴、钢琴、吉他`
                    }]
            };
        }
        let details = `🎵 ${instrument}学习信息：\n\n`;
        if (instrument === '小提琴') {
            details += `• 弦调音：${info.strings.join(', ')}\n`;
        }
        else if (instrument === '钢琴') {
            details += `• 琴键数：${info.keys}\n`;
        }
        else if (instrument === '吉他') {
            details += `• 弦调音：${info.strings.join(', ')}\n`;
        }
        details += `• 难度等级：${info.difficulty}\n`;
        details += `• 学习建议：${info.tips}`;
        return {
            content: [{
                    type: 'text',
                    text: details
                }]
        };
    }
    if (name === 'get_scale_notes') {
        const scale = args.scale;
        const notes = musicTheory.scales[scale];
        if (!notes) {
            return {
                content: [{
                        type: 'text',
                        text: `抱歉，暂不支持 ${scale}。目前支持：C大调、G大调、D大调`
                    }]
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `🎼 ${scale}音阶：\n${notes.join(' - ')}`
                }]
        };
    }
    if (name === 'practice_recommendation') {
        const instrument = args.instrument;
        const level = args.level || '初学者';
        const recommendations = {
            '小提琴': {
                '初学者': '1. 空弦练习（每天15分钟）\n2. 弓法练习：全弓、半弓\n3. 左手按弦：第一把位音阶\n4. 简单练习曲：《小星星》',
                '中级': '1. 音阶练习：三个八度\n2. 换把练习\n3. 双音练习\n4. 练习曲：巴赫《小步舞曲》',
                '高级': '1. 高把位练习\n2. 跳弓、连顿弓技巧\n3. 和弦与双音\n4. 协奏曲：门德尔松《e小调协奏曲》'
            },
            '钢琴': {
                '初学者': '1. 手型练习\n2. C大调音阶（双手）\n3. 哈农练习曲第1条\n4. 简单曲目：《欢乐颂》',
                '中级': '1. 所有大调音阶\n2. 琶音练习\n3. 车尔尼599\n4. 巴赫《创意曲》',
                '高级': '1. 李斯特练习曲\n2. 肖邦练习曲\n3. 巴赫《平均律》\n4. 贝多芬奏鸣曲'
            },
            '吉他': {
                '初学者': '1. 基础和弦：C、G、D、Em、Am\n2. 扫弦节奏练习\n3. 单音练习\n4. 简单歌曲：《小星星》',
                '中级': '1. 横按和弦（F、Bm）\n2. 指弹技巧\n3. 音阶练习\n4. 流行歌曲弹唱',
                '高级': '1. 爵士和弦\n2. 速弹技巧\n3. 即兴演奏\n4. 古典吉他曲目'
            }
        };
        const rec = recommendations[instrument]?.[level];
        if (!rec) {
            return {
                content: [{
                        type: 'text',
                        text: `请提供有效的乐器名称（小提琴、钢琴、吉他）和水平（初学者、中级、高级）`
                    }]
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `📚 ${instrument} ${level}练习建议：\n\n${rec}`
                }]
        };
    }
    throw new Error(`Unknown tool: ${name}`);
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.log('Music Learning Assistant MCP Server running on stdio');
}
main().catch(console.error);
