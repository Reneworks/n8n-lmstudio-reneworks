import {
    INodeType,
    INodeTypeDescription,
    ISupplyDataFunctions,
    SupplyData,
    NodeConnectionType,
    ILoadOptionsFunctions,
    INodePropertyOptions,
    NodeOperationError,
} from 'n8n-workflow';
import axios from 'axios';
import { McpChatModel as McpChatModelClass, LmStudioApiMode, McpChatModelFields } from './McpChatModel';

export class McpChatModel implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'LM Studio Chat Model',
        name: 'mcpChatModel',
        icon: 'file:McpChatModel.svg',
        group: ['transform'],
        version: 1,
        description: 'Chat Model for LM Studio with MCP support (native REST, OpenAI Chat Completions and Responses)',
        defaults: {
            name: 'LM Studio Chat Model',
        },
        credentials: [
            {
                name: 'lmStudioApi',
                required: false,
            },
        ],
        codex: {
            categories: ['AI'],
            subcategories: {
                AI: ['Language Models'],
            },
            resources: {
                primaryDocumentation: [
                    {
                        url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root/',
                    },
                ],
            },
        },
        inputs: [],
        outputs: [
            {
                displayName: 'Model',
                maxConnections: 1,
                type: 'ai_languageModel' as NodeConnectionType,
            },
        ],
        properties: [
            {
                displayName: 'API Mode',
                name: 'mode',
                type: 'options',
                default: 'native',
                options: [
                    {
                        name: 'LM Studio Native (MCP)',
                        value: 'native',
                        description: 'Usa /api/v1/chat con integraciones MCP/plugins, streaming y razonamiento',
                    },
                    {
                        name: 'OpenAI Chat Completions',
                        value: 'chat',
                        description: 'Usa /v1/chat/completions con tools (function calling) y JSON mode',
                    },
                    {
                        name: 'OpenAI Responses',
                        value: 'responses',
                        description: 'Usa /v1/responses con tools, MCP remoto y streaming',
                    },
                ],
                description:
                    'Protocolo de la API de LM Studio. "Native" mantiene el soporte completo de integraciones MCP. Para usar tools de agentes elige Chat Completions o Responses.',
            },
            {
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'http://localhost:1234',
                description:
                    'La URL base del servidor local de LM Studio (Developer > Server). Ej: http://localhost:1234',
            },
            {
                displayName: 'Model',
                name: 'model',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getModels',
                    loadOptionsDependsOn: ['baseUrl', 'mode'],
                },
                default: '',
                description: 'El modelo a usar (se carga la lista desde el servidor)',
            },
            {
                displayName: 'Integrations (JSON)',
                name: 'integrations',
                type: 'json',
                default: '[]',
                description:
                    'JSON array de integraciones LM Studio (plugins, ephemeral_mcp). Solo aplica al modo Native (y MCP remoto en Responses).',
            },
            {
                displayName: 'Options',
                name: 'options',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
                    {
                        displayName: 'Streaming',
                        name: 'streaming',
                        type: 'boolean',
                        default: true,
                        description: 'Transmitir tokens en tiempo real vía SSE cuando el agente lo solicite',
                    },
                    {
                        displayName: 'Temperature',
                        name: 'temperature',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 1,
                            numberStepSize: 0.1,
                        },
                        default: 0.7,
                        description: 'Randomness in token selection',
                    },
                    {
                        displayName: 'Max Tokens',
                        name: 'maxTokens',
                        type: 'number',
                        typeOptions: {
                            minValue: 1,
                        },
                        default: 2048,
                        description: 'Maximum number of tokens to generate',
                    },
                    {
                        displayName: 'Top P',
                        name: 'topP',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 1,
                            numberStepSize: 0.1,
                        },
                        default: 1,
                        description: 'Top-p sampling',
                    },
                    {
                        displayName: 'Top K',
                        name: 'topK',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                        },
                        default: 40,
                        description: 'Top-k sampling',
                    },
                    {
                        displayName: 'Min P',
                        name: 'minP',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 1,
                            numberStepSize: 0.05,
                        },
                        default: 0,
                        description: 'Min-p sampling (filtra tokens de baja probabilidad)',
                    },
                    {
                        displayName: 'Repeat Penalty',
                        name: 'repeatPenalty',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            numberStepSize: 0.1,
                        },
                        default: 1,
                        description: 'Penaliza repeticiones. 1 = sin penalización',
                    },
                    {
                        displayName: 'Seed',
                        name: 'seed',
                        type: 'number',
                        typeOptions: {
                            minValue: -1,
                        },
                        default: -1,
                        description: 'Semilla para resultados reproducibles. -1 = aleatorio',
                    },
                    {
                        displayName: 'Stop Sequences',
                        name: 'stop',
                        type: 'string',
                        default: '',
                        description: 'Secuencias de parada separadas por comas (solo Chat Completions)',
                    },
                    {
                        displayName: 'Presence Penalty',
                        name: 'presencePenalty',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 2,
                            numberStepSize: 0.1,
                        },
                        default: 0,
                        description: 'Penaliza repetir tokens ya presentes (solo Chat Completions)',
                    },
                    {
                        displayName: 'Frequency Penalty',
                        name: 'frequencyPenalty',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 2,
                            numberStepSize: 0.1,
                        },
                        default: 0,
                        description: 'Penaliza repetir tokens según frecuencia (solo Chat Completions)',
                    },
                    {
                        displayName: 'Context Length',
                        name: 'contextLength',
                        type: 'number',
                        typeOptions: {
                            minValue: 1,
                        },
                        default: 0,
                        description:
                            'Número de tokens a considerar como contexto (recomendado para MCP). 0 = automático. Solo modo Native.',
                    },
                    {
                        displayName: 'Reasoning',
                        name: 'reasoning',
                        type: 'options',
                        default: '',
                        options: [
                            { name: 'Auto', value: '' },
                            { name: 'Off', value: 'off' },
                            { name: 'Low', value: 'low' },
                            { name: 'Medium', value: 'medium' },
                            { name: 'High', value: 'high' },
                        ],
                        description: 'Nivel de razonamiento del modelo (si lo soporta). Solo Native/Responses.',
                    },
                    {
                        displayName: 'JSON Mode',
                        name: 'jsonMode',
                        type: 'boolean',
                        default: false,
                        description: 'Forzar respuesta en JSON. Solo Chat Completions / Responses.',
                    },
                    {
                        displayName: 'Response JSON Schema',
                        name: 'responseSchema',
                        type: 'json',
                        default: '',
                        description:
                            'JSON Schema opcional para structured output. Déjalo vacío para JSON genérico. Acóplalo con JSON Mode.',
                    },
                ],
            },
        ],
    };

    methods = {
        loadOptions: {
            async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const baseUrl = this.getCurrentNodeParameter('baseUrl') as string;
                const apiKey = await this.getCredentials('lmStudioApi').then(
                    (c: any) => (c && c.apiKey) || '',
                    () => ''
                );

                if (!baseUrl) {
                    return [];
                }

                let models: any[] = [];
                let lastError = '';
                for (const endpoint of [
                    `${baseUrl.replace(/\/+$/, '')}/api/v1/models`,
                    `${baseUrl.replace(/\/+$/, '')}/v1/models`,
                ]) {
                    try {
                        const headers: Record<string, string> = {};
                        if (apiKey) {
                            headers['Authorization'] = `Bearer ${apiKey}`;
                        }
                        const response = await axios.get(endpoint, {
                            headers,
                            timeout: 10000,
                        });
                        const body = response.data || {};
                        models = (body.data as any[]) || body.models || [];
                        if (models.length) {
                            break;
                        }
                    } catch (error: any) {
                        lastError =
                            error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
                    }
                }

                if (!models.length) {
                    throw new NodeOperationError(
                        this.getNode(),
                        `No se pudieron cargar los modelos desde ${baseUrl}. Asegúrate de que el servidor local de LM Studio esté activo (Developer > Server). ${
                            lastError ? `Detalle: ${lastError}` : ''
                        }`
                    );
                }

                return models
                    .map((model: any) => ({
                        name: model.id || model.key || model.display_name || model.name,
                        value: model.id || model.key || model.name,
                    }))
                    .filter((m: INodePropertyOptions) => m.name && m.value)
                    .sort((a: INodePropertyOptions, b: INodePropertyOptions) => a.name.localeCompare(b.name));
            },
        },
    };

    async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
        const mode = this.getNodeParameter('mode', itemIndex, 'native') as LmStudioApiMode;
        const baseUrl = this.getNodeParameter('baseUrl', itemIndex) as string;
        const modelName = this.getNodeParameter('model', itemIndex) as string;
        const integrations = this.getNodeParameter('integrations', itemIndex) as string;
        const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, any>;

        let apiKey = '';
        try {
            const credentials = await this.getCredentials('lmStudioApi');
            apiKey = (credentials && (credentials.apiKey as string)) || '';
        } catch {
            // Optional credential
        }

        const fields: McpChatModelFields = {
            baseUrl,
            modelName,
            apiKey,
            mode,
            integrations,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            topK: options.topK,
            minP: options.minP,
            repeatPenalty: options.repeatPenalty,
            seed: options.seed,
            stop: options.stop,
            presencePenalty: options.presencePenalty,
            frequencyPenalty: options.frequencyPenalty,
            contextLength: options.contextLength,
            reasoning: options.reasoning,
            jsonMode: options.jsonMode,
            responseSchema: options.responseSchema,
        };

        const model = new McpChatModelClass(fields);

        return {
            response: model,
        };
    }
}
