# n8n-nodes-lmstudio-reneworks

[English version (README.en.md)](./README.en.md)

Este es un nodo de comunidad para n8n que te permite conectar **LM Studio** directamente con los **AI Agents** de n8n, con soporte completo para servidores **MCP (Model Context Protocol)**.

Está diseñado para ser el puente perfecto entre tus modelos locales de LM Studio y las capacidades agenticas de n8n.

## ¿Por qué usar este nodo?

1.  **Compatibilidad nativa con AI Agents**: Se conecta perfectamente al input de "Model" de los agentes de n8n.
2.  **Soporte MCP**: Permite usar herramientas (herramientas de búsqueda, navegación, base de datos, etc.) conectando servidores MCP directamente en las opciones del nodo.
3.  **Optimizado para LM Studio**: Configurado para usar el endpoint `/api/v1/chat` de LM Studio, manejando el historial de conversación de forma eficiente.
4.  **Lista dinámica de modelos**: Una vez configurada la URL, el nodo carga automáticamente los modelos que tienes descargados en LM Studio.

## Instalación

En tu instancia de n8n (Settings > Community Nodes), instala el paquete:

```bash
n8n-nodes-lmstudio-reneworks
```

O vía terminal en tu directorio de n8n:

```bash
npm install n8n-nodes-lmstudio-reneworks
```

## Configuración

1.  Asegúrate de tener **LM Studio** abierto y el **Local Server** activado (generalmente en `http://localhost:1234`).
2.  En n8n, arrastra el nodo **LM Studio Chat Model**.
3.  Configura la **Base URL** (ej. `http://localhost:1234`).
4.  Selecciona el **Model** de la lista desplegable (se cargará automáticamente).
5.  **Opciones**: Configura temperatura, tokens máximos, etc.
6.  **Integraciones (Opcional)**: Aquí es donde ocurre la magia de MCP. Puedes pasar una configuración JSON para habilitar servidores MCP externos.

### Ejemplo de Integraciones (MCP)

Puedes habilitar herramientas como navegación web con Playwright o búsqueda en Hugging Face:

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

## Funcionamiento técnico

Este nodo actúa como un wrapper de LangChain que traduce las peticiones de n8n al formato específico de la API de LM Studio. Maneja automáticamente:
- La extracción del `System Prompt`.
- La concatenación del historial de chat para máxima compatibilidad con modelos locales.
- La gestión de herramientas y plugins vía el sistema de integraciones de LM Studio.

---
Desarrollado con ❤️ por **Antigravity** para la comunidad de n8n.
Visita mi web: [reneworks.mx](https://reneworks.mx)
