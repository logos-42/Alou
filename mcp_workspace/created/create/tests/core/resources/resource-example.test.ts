import { describe, expect, test } from 'bun:test';
import { loadExampleResource } from '@/src/core/resources/resource-example';

describe('loadExampleResource', () => {
	test('should return a resource with the given ID', async () => {
		const id = '123';
		const result = await loadExampleResource({ id });
		expect(result).toEqual({
			text: `This is an example resource with ID: ${id}`,
		});
	});
});
