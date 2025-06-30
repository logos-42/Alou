# AI Agent Rules for this Codebase

These rules are designed to guide AI agents working on this codebase to ensure consistency, quality, and maintainability.

## General Principles

1.  **Understand the Architecture**: Before making changes, thoroughly review `ARCHITECTURE.md` to understand the project structure, core components (Prompts, Resources, Tools), and server initialization flow.
2.  **Prioritize Readability and Maintainability**: Write clear, concise, and well-documented code. Avoid overly complex solutions. If a solution is complex, ensure it's adequately explained.
3.  **Adhere to Existing Patterns**: Follow the established coding patterns and conventions found in the `src/` directory. For example, observe how prompts, resources, and tools are structured and registered.
4.  **Strong Typing**: Ensure all code is correctly and consistently typed using TypeScript. Leverage shared types where applicable to prevent redundancy and improve maintainability.
5.  **Comprehensive Documentation**: Create and update relevant documentation (including in-code comments and Markdown files like `ARCHITECTURE.md` and `AGENT_RULES.md`) for all new features, significant changes, and complex logic.
6.  **Test Thoroughly**: Any new features or bug fixes must be accompanied by relevant unit or integration tests in the `tests/` directory. Aim for high test coverage for all new functionality.
7.  **Error Handling**: Implement robust error handling for all new or modified functionalities. Log errors effectively for debugging purposes.
8.  **Security**: Always consider security implications. Avoid introducing vulnerabilities, especially when dealing with external inputs or interactions.

## Core Technologies

This project heavily relies on:

- **FastMCP**: The framework for building the Message Control Protocol server.
- **Zod**: For schema validation and type inference, ensuring data integrity.

## Specific Guidelines

### Modifying Core Components (Prompts, Resources, Tools)

-   When adding a new prompt, resource, or tool, ensure it's registered correctly in its respective `index.ts` file within `src/core/`.
-   Each component should have a clear purpose and ideally follow a single responsibility principle.

### Server Modifications

-   Changes to `src/server/server.ts` should be minimal and carefully considered, as this file is central to the application's startup.
-   New server configurations or routes should be well-documented.

### Dependency Management

-   When adding new dependencies, ensure they are absolutely necessary and are added to `package.json` with appropriate versioning.

## Review Process

-   All significant changes should ideally be reviewed by a human or another AI agent to catch potential issues and ensure alignment with project goals. 