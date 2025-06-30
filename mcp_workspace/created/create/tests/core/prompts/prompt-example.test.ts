import { describe, expect, test } from 'bun:test';
import { loadGreetingPrompt } from '@/src/core/prompts/prompt-example';

describe('loadGreetingPrompt', () => {
	test('should return a greeting message', async () => {
		const name = 'World';
		const result = await loadGreetingPrompt({ name });
		expect(result).toBe('Hello, World! How can I help you today?');
	});
});
