import type { Tool } from 'fastmcp';
import { z } from 'zod';

const hellWorldParametersSchema = z.object({
	name: z.string().describe('Name to greet'),
});

export async function executeHelloWorld(params: { name: string }) {
	return `Hello, ${params.name}!`;
}

export const helloWorldTool = {
	name: 'hello_world',
	description: 'A simple hello world tool',
	parameters: hellWorldParametersSchema,
	execute: executeHelloWorld,
} satisfies Tool<undefined, typeof hellWorldParametersSchema>; 