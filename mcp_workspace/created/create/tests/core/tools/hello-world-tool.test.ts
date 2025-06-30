import { describe, expect, test } from 'bun:test';
import {
	executeHelloWorld,
} from '@/src/core/tools/hello-world-tool';

describe('executeHelloWorld', () => {
	test('should return a hello world greeting', async () => {
		const name = 'TestUser';
		const result = await executeHelloWorld({ name });
		expect(result).toBe('Hello, TestUser!');
	});
}); 