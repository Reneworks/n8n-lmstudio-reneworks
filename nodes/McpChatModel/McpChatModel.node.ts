import {
    INodeType,
    INodeTypeDescription,
    ISupplyDataFunctions,
    SupplyData,
    NodeConnectionType,
    ILoadOptionsFunctions,
    INodePropertyOptions,
} from 'n8n-workflow';
import axios from 'axios';
import { McpChatModel as McpChatModelClass } from './McpChatModel';

export class McpChatModel implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'LM Studio Chat Model',
        name: 'mcpChatModel',
        icon: 'file:McpChatModel.svg',
        group: ['transform'],
        version: 1,
        description: 'Chat Model for LM Studio with MCP support',
        defaults: {
            name: 'MCP Chat Model',
        },
        credentials: [],
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
        // Define inputs/outputs for connection to AI Agent
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
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'http://localhost:1234',
                description: 'The base URL of the MCP Chat API',
            },
            {
                displayName: 'Model',
                name: 'model',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getModels',
                    loadOptionsDependsOn: ['baseUrl', 'apiKey'],
                },
                default: '',
                description: 'The model to use',
            },
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                description: 'Optional API Key',
            },
            {
                displayName: 'Integrations (JSON)',
                name: 'integrations',
                type: 'json',
                default: '[]',
                description: 'JSON array of integrations (plugins, ephemeral_mcp)',
            },
            {
                displayName: 'Options',
                name: 'options',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
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
                        description: 'Sampling temperature',
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
                ],
            },
        ],
    };


    methods = {
        loadOptions: {
            async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const baseUrl = this.getCurrentNodeParameter('baseUrl') as string;
                const apiKey = this.getCurrentNodeParameter('apiKey') as string;

                if (!baseUrl) {
                    return [];
                }

                try {
                    const headers: any = {};
                    if (apiKey) {
                        headers['Authorization'] = `Bearer ${apiKey}`;
                    }

                    const response = await axios.get(`${baseUrl}/api/v1/models`, { headers });
                    const models = response.data.models || [];

                    return models.map((model: any) => ({
                        name: model.id || model.key || model.display_name,
                        value: model.id || model.key,
                    }));
                } catch (error) {
                    return [];
                }
            },
        },
    };

    async supplyData(
        this: ISupplyDataFunctions,
        itemIndex: number
    ): Promise<SupplyData> {
        const baseUrl = this.getNodeParameter('baseUrl', itemIndex) as string;
        const modelName = this.getNodeParameter('model', itemIndex) as string;
        const apiKey = this.getNodeParameter('apiKey', itemIndex) as string;
        const integrations = this.getNodeParameter('integrations', itemIndex) as string;
        const options = this.getNodeParameter('options', itemIndex, {}) as {
            temperature?: number;
            maxTokens?: number;
            topP?: number;
            topK?: number;
        };

        const model = new McpChatModelClass({
            baseUrl,
            modelName,
            apiKey,
            integrations,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            topK: options.topK,
        });

        return {
            response: model,
        };
    }
}
