# n8n-nodes-lmstudio-reneworks

[English version (README.en.md)](./README.en.md)

Nodo de comunidad para n8n que conecta **LM Studio** con los **AI Agents** de n8n, con soporte completo para servidores **MCP (Model Context Protocol)** y tres modos de API.

## Por que usar este nodo

- **Multi-modos**: Elige entre la API nativa de LM Studio, Chat Completions OpenAI, o Responses OpenAI segun las necesidades de tu agente.
- **Tool calling**: Compatible con herramientas de LangChain y MCP. Funciona en el modo nativo (MCP), Chat Completions (tools JSON) y Responses (tools JSON + MCP).
- **Streaming en tiempo real**: Eventos SSE nativos: `message.delta`, `chat.end`, `error`.
- **Lista dinamica de modelos**: Carga automaticamente los modelos descargados en LM Studio.
- **Autenticacion opcional**: API key compatible con LM Studio y proveedores OpenAI.

## Instalacion

En tu instancia de n8n (Settings > Community Nodes):

```bash
npm install n8n-nodes-lmstudio-reneworks
```

O localmente:

```bash
npm install n8n-nodes-lmstudio-reneworks
```

## Configuracion rapida

1. Abre LM Studio y activa el **Local Server** (`http://localhost:1234` por defecto).
2. En n8n, agrega el nodo **LM Studio Chat Model**.
3. Configura la **Base URL**.
4. Selecciona el **Model** de la lista desplegable.
5. Elige el **API Mode** segun tu caso de uso.

## Modos de API

### Native (`/api/v1/chat`) - Recomendado para LM Studio

El modo nativo es el original y mas simple. Ideal para chat conversacional sin herramientas externas.

- MCP via `integrations` (array JSON)
- Historial de conversacion como texto concatenado
- Context length configurado
- **No** soporta tool calling personalizado (usa el modo Chat Completions o Responses para eso)

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

Compatible con la API OpenAI estandar. El mejor modo para AI Agents que necesitan tool calling con JSON.

- Tools en formato OpenAI (`convertToOpenAITool`)
- JSON mode con `response_format: { type: "json_schema" }`
- System prompt como mensaje de sistema
- Historial como array de mensajes
- Streaming SSE

### Responses (`/v1/responses`)

La API de respuestas de OpenAI. Combina MCP remoto con tool calling nativo.

- MCP remoto como herramientas tipo `mcp`
- Tool calling via `convertToOpenAITool`
- JSON mode con `text.format: { type: "json_schema" }`
- Streaming SSE

## Parametros

| Parametro | Descripcion |
|-----------|-------------|
| API Mode | `native`, `chat` o `responses` |
| Streaming | Habilita streaming SSE (solo chat y responses) |
| Temperature | 0-2. Controla la aleatoriedad |
| Max Tokens | Limite de tokens de salida |
| Top P | Nucleo de muestreo (0-1) |
| Top K | Limite de vocabulario |
| Min P | Filtro de probabilidad minima |
| Repeat Penalty | Penalizacion de repeticion |
| Seed | Semilla para reproducibilidad |
| Stop | Tokens de parada (separados por coma) |
| Presence Penalty | Penalizacion por presencia |
| Frequency Penalty | Penalizacion por frecuencia |
| Context Length | Longitud del contexto |
| Reasoning | Habilita razonamiento en modelos compatibles |
| JSON Mode | Habilita modo JSON |
| Response Schema | Schema para JSON mode |

## Ejemplo con AI Agent

```
[LM Studio Chat Model] --> [AI Agent]
         |
         Base URL: http://localhost:1234
         Model: modelo-local
         API Mode: responses
         Integrations: [...]
```

## Ejemplo de Integraciones (MCP)

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

## Credencial (opcional)

El nodo soporta una API key opcional para autenticacion. Si LM Studio o tu proveedor la requiere, configurala en los Credentials de n8n (LM Studio API). Si no la necesitas, deja el campo vacio.

## Funcionamiento tecnico

El nodo actua como un wrapper de LangChain que traduce las peticiones de n8n al formato especifico de la API seleccionada:

- **Native**: Maneja el historial de chat como texto concatenado y el sistema de integraciones MCP nativo.
- **Chat**: Formato OpenAI estandar con tool calling y JSON mode.
- **Responses**: API de respuestas de OpenAI con MCP remoto y tool calling.
- **Streaming**: Eventos SSE en tiempo real para los modos chat y responses.

---

Desarrollado con ❤️ para la comunidad de n8n.
Visita mi web: [reneworks.mx](https://reneworks.mx)
