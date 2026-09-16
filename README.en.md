# n8n-nodes-lmstudio-reneworks

[![npm version](https://img.shields.io/npm/v/n8n-nodes-lmstudio-reneworks)](https://www.npmjs.com/package/n8n-nodes-lmstudio-reneworks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-blue.svg)](https://www.npmjs.com/package/n8n-nodes-lmstudio-reneworks)
[![Security](https://img.shields.io/badge/security-audit%20passed-brightgreen.svg)](./SECURITY.md)
[![Tests](https://img.shields.io/badge/tests-8%2F8%20passing-brightgreen.svg)]()

[Version en Espanol (README.md)](./README.md)

Community node for n8n that connects **LM Studio** with n8n **AI Agents**, with full support for **MCP (Model Context Protocol)** servers and three API modes.

## Why use this node

- **Multi-mode**: Choose between LM Studio native API, OpenAI Chat Completions, or OpenAI Responses depending on your agent's needs.
- **Tool calling**: Compatible with LangChain tools and MCP. Works in native mode (MCP), Chat Completions (JSON tools), and Responses (JSON tools + MCP).
- **Real-time streaming**: Native SSE events: `message.delta`, `chat.end`, `error`.
- **Dynamic model list**: Automatically loads models downloaded in LM Studio.
- **Optional authentication**: API key compatible with LM Studio and OpenAI providers.

## Installation

In your n8n instance (Settings > Community Nodes):

```bash
npm install n8n-nodes-lmstudio-reneworks
```

Or locally:

```bash
npm install n8n-nodes-lmstudio-reneworks
```

## Quick setup

1. Open LM Studio and enable the **Local Server** (`http://localhost:1234` by default).
2. In n8n, add the **LM Studio Chat Model** node.
3. Set the **Base URL**.
4. Select the **Model** from the dropdown.
5. Choose the **API Mode** for your use case.

## API Modes

### Native (`/api/v1/chat`) - Recommended for LM Studio

The original and simplest mode. Ideal for conversational chat without external tools.

- MCP via `integrations` (JSON array)
- Conversation history as concatenated text
- Configurable context length
- **Does not** support custom tool calling (use Chat Completions or Responses for that)

```json
[
  {
    "type": "ephemeral_mcp",
    "server_label": "huggingface",
    "server_url": "https://huggingface.co/mcp",
    "allowed_tools": ["model_search"]
  }
]
```

### Chat Completions (`/v1/chat/completions`)

Compatible with the standard OpenAI API. Best mode for AI Agents that need tool calling with JSON.

- Tools in OpenAI format (`convertToOpenAITool`)
- JSON mode with `response_format: { type: "json_schema" }`
- System prompt as system message
- History as message array
- SSE streaming

### Responses (`/v1/responses`)

OpenAI's Responses API. Combines remote MCP with native tool calling.

- Remote MCP as `mcp` type tools
- Tool calling via `convertToOpenAITool`
- JSON mode with `text.format: { type: "json_schema" }`
- SSE streaming

## Parameters

| Parameter | Description |
|-----------|-------------|
| API Mode | `native`, `chat`, or `responses` |
| Streaming | Enable SSE streaming (chat and responses only) |
| Temperature | 0-2. Controls randomness |
| Max Tokens | Output token limit |
| Top P | Nucleus sampling (0-1) |
| Top K | Vocabulary limit |
| Min P | Minimum probability filter |
| Repeat Penalty | Repetition penalty |
| Seed | Seed for reproducibility |
| Stop | Stop tokens (comma-separated) |
| Presence Penalty | Presence penalty |
| Frequency Penalty | Frequency penalty |
| Context Length | Context length |
| Reasoning | Enable reasoning in compatible models |
| JSON Mode | Enable JSON mode |
| Response Schema | Schema for JSON mode |

## Example with AI Agent

```
[LM Studio Chat Model] --> [AI Agent]
         |
         Base URL: http://localhost:1234
         Model: local-model
         API Mode: responses
         Integrations: [...]
```

## Integration example (MCP)

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

## Credential (optional)

The node supports an optional API key for authentication. If LM Studio or your provider requires it, configure it in n8n Credentials (LM Studio API). If not needed, leave the field empty.

## Technical details

The node acts as a LangChain wrapper that translates n8n requests to the selected API format:

- **Native**: Manages conversation history as concatenated text and LM Studio's native MCP integration system.
- **Chat**: Standard OpenAI format with tool calling and JSON mode.
- **Responses**: OpenAI Responses API with remote MCP and tool calling.
- **Streaming**: Real-time SSE events for chat and responses modes.

---

Developed with love for the n8n community.
Visit my website: [reneworks.mx](https://reneworks.mx)
