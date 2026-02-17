# n8n-nodes-mcp-chat

This is an n8n community node that lets you use an MCP-enabled Chat API as a Language Model in n8n.

## Installation

### For Local n8n
1.  Go to your n8n root directory (e.g. `~/.n8n`).
2.  Create a `custom` directory if it doesn't exist: `mkdir custom`.
3.  Clone or copy this repository into `custom/n8n-nodes-mcp-chat`.
4.  Inside `custom/n8n-nodes-mcp-chat`, run `npm install` and `npm run build`.
5.  In `~/.n8n`, run `npm install ./custom/n8n-nodes-mcp-chat`.
6.  Start n8n: `n8n start`.

### For Docker
You need to build a custom Docker image or mount the volume. Use the `n8n-nodes-starter` guide for details on mounting.

## Usage

1.  Open your n8n workflow.
2.  Add an **AI Agent** node.
3.  Add the **MCP Chat Model** node.
4.  Connect the **MCP Chat Model** output to the **Model** input of the **AI Agent**.
5.  Configure the **MCP Chat Model**:
    *   **Base URL**: The address of your MCP Chat API (default: `http://localhost:1234`).
    *   **Model Name**: The model identifier (e.g., `ibm/granite-4-micro`).
    *   **Integrations**: Paste the JSON configuration for your MCP servers/plugins.

### Example Integrations JSON
```json
[
  {
    "type": "ephemeral_mcp",
    "server_label": "huggingface",
    "server_url": "https://huggingface.co/mcp",
    "allowed_tools": [
      "model_search"
    ]
  },
  {
    "type": "plugin",
    "id": "mcp/playwright",
    "allowed_tools": [
      "browser_navigate"
    ]
  }
]
```
