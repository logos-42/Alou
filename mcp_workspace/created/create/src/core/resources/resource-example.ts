import type { ResourceTemplate, ResourceTemplateArgument } from 'fastmcp';

const exampleResourceArguments: ResourceTemplateArgument[] = [
	{
		name: 'id',
		description: 'Resource ID',
	},
];

export async function loadExampleResource({ id }: { id: string }) {
	return {
		text: `This is an example resource with ID: ${id}`,
	};
}

export const exampleResource: ResourceTemplate<
	typeof exampleResourceArguments
> = {
	uriTemplate: 'example://{id}',
	name: 'Example Resource',
	mimeType: 'text/plain',
	arguments: exampleResourceArguments,
	load: loadExampleResource as ResourceTemplate['load'],
};
