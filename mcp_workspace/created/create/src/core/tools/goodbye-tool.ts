import type { Tool } from 'fastmcp';
import { z } from 'zod';

const goodbyeParametersSchema = z.object({
	name: z.string().describe('Name to bid farewell to'),
});

export async function executeGoodbye(params: { name: string }) {
	return `Goodbye, ${params.name}!`;
}

export const goodbyeTool = {
	name: 'goodbye',
	description: 'A simple goodbye tool',
	parameters: goodbyeParametersSchema,
	execute: executeGoodbye,
} satisfies Tool<undefined, typeof goodbyeParametersSchema>; 