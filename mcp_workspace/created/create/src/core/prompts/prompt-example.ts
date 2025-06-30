import type { InputPrompt, PromptArgument } from 'fastmcp';

const greetingPromptArguments: PromptArgument[] = [
	{
		name: 'name',
		description: 'A name to greet',
		required: true,
	},
];

export async function loadGreetingPrompt({ name }: { name: string }) {
	return `Hello, ${name}! How can I help you today?`;
}

export const greetingPrompt: InputPrompt<typeof greetingPromptArguments> = {
	name: 'greeting',
	description: 'A simple greeting prompt',
	arguments: greetingPromptArguments,
	load: loadGreetingPrompt as InputPrompt['load'],
};
