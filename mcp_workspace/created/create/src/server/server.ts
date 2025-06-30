import { FastMCP } from 'fastmcp';
import { registerPrompts } from '@/src/core/prompts';
import { registerResources } from '@/src/core/resources';
import { registerTools } from '@/src/core/tools';

async function startServer() {
	try {
		const server = new FastMCP({
			name: 'MCP Server',
			version: '1.0.0',
			health: {
				enabled: true,
				message: 'healthy',
				path: '/healthz',
				status: 200,
			},
		});

		registerResources(server);
		registerTools(server);
		registerPrompts(server);

		console.log('MCP Server initialized');
		console.log('Server is ready to handle requests');

		return server;
	} catch (error) {
		console.error('Failed to initialize server:', error);
		process.exit(1);
	}
}

export default startServer;
