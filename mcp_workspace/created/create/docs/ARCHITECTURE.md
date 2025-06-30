# Architecture Overview

This project serves as an opinionated starter template for building a TypeScript MCP (Message Control Protocol) server, built on **Bun**.

## Folder Structure

```

  src/
    core/
      prompts/ (definitions for prompts/messages)
      resources/ (definitions for data sources or external services)
      tools/ (definitions for agent tools/utilities)
    server/ (server initialization and configuration)
  tests/
    core/
      prompts/
      resources/
      tools/
```

## Core Components

The server is initialized in `src/server/server.ts` and leverages three main types of components:

- **Prompts**: Defined in `src/core/prompts/`, these are responsible for generating user-facing prompts or messages.
- **Resources**: Defined in `src/core/resources/`, these likely represent data sources or external services the agent can interact with.
- **Tools**: Defined in `src/core/tools/`, these are functions or utilities that the agent can use to perform actions or process information.

## Component Registration

- `registerResources(server)`: Loads and registers all resources.
- `registerTools(server)`: Loads and registers all tools.
- `registerPrompts(server)`: Loads and registers all prompts.

Each of these registration functions (e.g., `src/core/prompts/index.ts`, `src/core/resources/index.ts`, `src/core/tools/index.ts`) is responsible for importing and registering individual components within their respective directories.

## Testing

Tests are located in the `tests/` directory, mirroring the `src/` directory structure.

## Relevant Resources

- [FastMCP Documentation](https://github.com/punkpeye/fastmcp) 
- [MCP Documentation](https://modelcontextprotocol.io/introduction)
- [Zod Documentation](https://zod.dev/)
