import type { FastMCP } from 'fastmcp';
import { helloWorldTool } from './hello-world-tool';
import { goodbyeTool } from './goodbye-tool';

/**
 * Register all tools with the MCP server
 *
 * @param server The FastMCP server instance
 */
export function registerTools(server: FastMCP) {
	server.addTool(helloWorldTool);
	server.addTool(goodbyeTool);
}
