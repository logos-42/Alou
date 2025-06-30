# 🚀 TypeScript MCP Server Starter Template

<div style="display: flex; align-items: center; margin-bottom: 2rem; gap: 1rem; justify-content: center;">
  <img src="./readme-logos/typescript.svg" width="128" height="128" alt="TypeScript Logo" />
  <img src="./readme-logos/model-context-protocol.svg" width="128" height="128" alt="Model Context Protocol Logo" />
</div>

---
![Model Context Protocol](https://img.shields.io/badge/Model%20Context%20Protocol-Server-blueviolet)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
---


This repository provides an opinionated starter template for building a TypeScript-based [MCP (Model Context Protocol)](https://github.com/punkpeye/fastmcp) server. It's designed to give you a quick and robust foundation for your agent-powered applications. ✨

### 🚀 Quick Start

```bash
bunx mcp-create my-mcp-server
cd my-mcp-server
bun install
bun dev # For stdio Transport
# OR
bun dev:http # For streamable Http Transport
```

## ⚡ Powered by [FastMCP](https://github.com/punkpeye/fastmcp)

At its core, this server is built using [FastMCP](https://github.com/punkpeye/fastmcp), a lightweight and efficient framework for creating MCP servers. This template also leverages [Bun](https://bun.sh/) for a blazing-fast development and runtime experience, and [Zod](https://zod.dev/) for robust schema validation and type inference. 

## 🏗️ Architecture Overview

This template follows a clear and modular architecture, making it easy to extend and maintain:

-   **`src/`**: Contains the main source code.
    -   **`core/`**: Houses the fundamental building blocks of your MCP server:
        -   `prompts/`: Definitions for generative prompts and messages.
        -   `resources/`: Abstractions for external data sources or services.
        -   `tools/`: Implementations of actions or utilities your agent can perform.
    -   **`server/`**: Contains the server initialization and configuration logic.
-   **`tests/`**: Unit and integration tests, mirroring the `src/` structure.
-   **`docs/`**: Important documentation for both human and AI agents, including `ARCHITECTURE.md` and `AGENT_RULES.md`.

For a more detailed breakdown, refer to `docs/ARCHITECTURE.md`. 📖

## 🐳 Running in Docker

You can containerize and run your MCP server using Docker. This template includes a `Dockerfile` and convenient `npm` scripts.

1.  **Build the Docker image:**
    ```bash
    bun run docker:build
    ```
    This will build an image named `typescript-mcp-server-template`.

2.  **Run the Docker container:**
    ```bash
    bun run docker:run
    ```
    This command will run the container, mapping port `3697` (or `PORT` environment variable) from the container to your host.

3.  **Stop the Docker container:**
    ```bash
    bun run docker:stop
    ```

## 🔌 Connecting to an MCP Client

Your MCP server can be easily integrated with any MCP client. Here are example configurations for both HTTP Stream and Stdio transports:

### **Streamable Http Transport:**

```json
{
  "StreamableHttpServerConfig ": {
    "url": "http://localhost:3697/mcp",
    "type": "httpStream"
  }
}
```

### **stdio Transport**

```json
{
  "stdioServerConfig": {
    "command": "npx",
    "args": [
        "tsx",
        "--tsconfig",
        "<absolute-path>/tsconfig.json",
        "<absolute-path>/src/index.ts"
      ]
  }
}
```


## 📝 Contributing

We welcome contributions! Please refer to [our contribution guidelines(agents and humans)](docs/AGENT_RULES.md) for important rules regarding typing, documentation, and testing. 🤝
