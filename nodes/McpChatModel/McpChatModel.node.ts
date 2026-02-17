import {
    INodeType,
    INodeTypeDescription,
    ISupplyDataFunctions,
    SupplyData,
    NodeConnectionType,
} from 'n8n-workflow';
import { McpChatModel as McpChatModelClass } from './McpChatModel';

export class McpChatModel implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'MCP Chat Model',
        name: 'mcpChatModel',
        icon: 'fa:comment-dots',
        group: ['transform'],
        version: 1,
        description: 'Chat Model connected via MCP',
        defaults: {
            name: 'MCP Chat Model',
        },
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
                type: 'ai_language_model' as NodeConnectionType,
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
                displayName: 'Model Name',
                name: 'modelName',
                type: 'string',
                default: 'ibm/granite-4-micro',
                description: 'The name of the model to use',
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
    };

    async supplyData(
        this: ISupplyDataFunctions,
        itemIndex: number
    ): Promise<SupplyData> {
        const baseUrl = this.getNodeParameter('baseUrl', itemIndex) as string;
        const modelName = this.getNodeParameter('modelName', itemIndex) as string;
        const apiKey = this.getNodeParameter('apiKey', itemIndex) as string;
        const integrations = this.getNodeParameter('integrations', itemIndex) as string;
        const temperature = this.getNodeParameter('temperature', itemIndex) as number;
        const maxTokens = this.getNodeParameter('maxTokens', itemIndex) as number;
        const topP = this.getNodeParameter('topP', itemIndex) as number;
        const topK = this.getNodeParameter('topK', itemIndex) as number;

        const model = new McpChatModelClass({
            baseUrl,
            modelName,
            apiKey,
            integrations, // McpChatModel constructor parses this string
            temperature,
            maxTokens,
            topP,
            topK,
        });

        return {
            response: model,
        };
    }
}
