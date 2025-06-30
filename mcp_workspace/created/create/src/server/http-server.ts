import startServer from './server';

const PORT = Number.parseInt(process.env.PORT || '3697', 10);

async function main() {
	try {
		const server = await startServer();

		server.start({
			transportType: 'httpStream',
			httpStream: {
				port: PORT,
			},
		});

		console.log(`MCP Server running at http://localhost:${PORT}`);
		console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
		console.log(`Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
}

process.on('SIGINT', () => {
	console.error('Shutting down server...');
	process.exit(0);
});

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
