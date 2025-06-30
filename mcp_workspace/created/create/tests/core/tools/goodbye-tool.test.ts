import { describe, expect, test } from 'bun:test';
import {
	executeGoodbye,
} from '@/src/core/tools/goodbye-tool';

describe('executeGoodbye', () => {
	test('should return a goodbye greeting', async () => {
		const name = 'TestUser';
		const result = await executeGoodbye({ name });
		expect(result).toBe('Goodbye, TestUser!');
	});
}); 