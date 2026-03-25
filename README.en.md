# n8n-nodes-lmstudio-reneworks

This is a community node for n8n that allows you to connect **LM Studio** directly with n8n **AI Agents**, with full support for **MCP (Model Context Protocol)** servers.

It is designed to be the perfect bridge between your local LM Studio models and n8n's agentic capabilities.

## Why use this node?

1.  **Native AI Agents Compatibility**: Connects perfectly to the "Model" input of n8n agents.
2.  **MCP Support**: Allows using tools (search tools, navigation, database, etc.) by connecting MCP servers directly in the node options.
3.  **Optimized for LM Studio**: Configured to use the LM Studio `/api/v1/chat` endpoint, managing conversation history efficiently.
4.  **Dynamic Model List**: Once the URL is configured, the node automatically loads the models you have downloaded in LM Studio.

## Installation

In your n8n instance (Settings > Community Nodes), install the package:

```bash
n8n-nodes-lmstudio-reneworks
```

Or via terminal in your n8n directory:

```bash
npm install n8n-nodes-lmstudio-reneworks
```

## Configuration

1.  Ensure you have **LM Studio** open and the **Local Server** activated (usually at `http://localhost:1234`).
2.  In n8n, drag the **LM Studio Chat Model** node.
3.  Configure the **Base URL** (e.g., `http://localhost:1234`).
4.  Select the **Model** from the dropdown list (it will load automatically).
5.  **Options**: Configure temperature, max tokens, etc.
6.  **Integrations (Optional)**: This is where MCP magic happens. You can pass a JSON configuration to enable external MCP servers.

### Integration Example (MCP)

You can enable tools like web navigation with Playwright or search on Hugging Face:

```json
[
  {
    "type": "ephemeral_mcp",
    "server_label": "huggingface",
    "server_url": "https://huggingface.co/mcp",
    "allowed_tools": ["model_search"]
  },
  {
    "type": "plugin",
    "id": "mcp/playwright",
    "allowed_tools": ["browser_navigate"]
  }
]
```

## Technical Operation

This node acts as a LangChain wrapper that translates n8n requests to the specific LM Studio API format. It automatically handles:
- `System Prompt` extraction.
- Chat history concatenation for maximum compatibility with local models.
- Tool and plugin management via LM Studio's integration system.

---
Developed with ❤️ for the n8n community.
Visit my website: [reneworks.mx](https://reneworks.mx)
