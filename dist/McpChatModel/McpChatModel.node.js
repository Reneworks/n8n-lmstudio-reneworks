"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpChatModel = void 0;
const axios_1 = __importDefault(require("axios"));
const McpChatModel_1 = require("./McpChatModel");
class McpChatModel {
    constructor() {
        this.description = {
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
                    type: 'ai_languageModel',
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
        this.methods = {
            loadOptions: {
                async getModels() {
                    const baseUrl = this.getCurrentNodeParameter('baseUrl');
                    const apiKey = this.getCurrentNodeParameter('apiKey');
                    if (!baseUrl) {
                        return [];
                    }
                    try {
                        const headers = {};
                        if (apiKey) {
                            headers['Authorization'] = `Bearer ${apiKey}`;
                        }
                        const response = await axios_1.default.get(`${baseUrl}/api/v1/models`, { headers });
                        const models = response.data.models || [];
                        return models.map((model) => ({
                            name: model.id || model.key || model.display_name,
                            value: model.id || model.key,
                        }));
                    }
                    catch (error) {
                        return [];
                    }
                },
            },
        };
    }
    async supplyData(itemIndex) {
        const baseUrl = this.getNodeParameter('baseUrl', itemIndex);
        const modelName = this.getNodeParameter('model', itemIndex);
        const apiKey = this.getNodeParameter('apiKey', itemIndex);
        const integrations = this.getNodeParameter('integrations', itemIndex);
        const options = this.getNodeParameter('options', itemIndex, {});
        const model = new McpChatModel_1.McpChatModel({
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
exports.McpChatModel = McpChatModel;
