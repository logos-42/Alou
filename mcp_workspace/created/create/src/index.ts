import startServer from './server/server';

async function main() {
	try {
		const server = await startServer();

		server.start({
			transportType: 'stdio',
		});

		console.log('MCP Server running on stdio');
	} catch (error) {
		console.error('Error starting MCP server:', error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('Fatal error in main():', error);
	process.exit(1);
});
