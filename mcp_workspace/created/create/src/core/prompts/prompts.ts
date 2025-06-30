import type { FastMCP } from 'fastmcp';
import { greetingPrompt } from './prompt-example';

/**
 * Register all prompts with the MCP server
 * @param server The FastMCP server instance
 */
export function registerPrompts(server: FastMCP) {
	server.addPrompt(greetingPrompt);
}
