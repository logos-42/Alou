import type { FastMCP } from 'fastmcp';
import { exampleResource } from './resource-example';

/**
 * Register all resources with the MCP server
 * @param server The FastMCP server instance
 */
export function registerResources(server: FastMCP) {
	server.addResourceTemplate(exampleResource);
}
