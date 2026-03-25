"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpChatModel = void 0;
const chat_models_1 = require("@langchain/core/language_models/chat_models");
const messages_1 = require("@langchain/core/messages");
const axios_1 = __importDefault(require("axios"));
class McpChatModel extends chat_models_1.BaseChatModel {
    constructor(fields) {
        super(fields);
        this.baseUrl = fields.baseUrl;
        this.modelName = fields.modelName;
        this.apiKey = fields.apiKey;
        this.temperature = fields.temperature;
        this.maxTokens = fields.maxTokens;
        this.topP = fields.topP;
        this.topK = fields.topK;
        try {
            this.integrations = fields.integrations
                ? JSON.parse(fields.integrations)
                : [];
        }
        catch (e) {
            console.error('Failed to parse integrations JSON', e);
            this.integrations = [];
        }
    }
    _llmType() {
        return 'lmstudio_chat_model';
    }
    bindTools(tools, kwargs) {
        // n8n/LangChain will see the model supports tools.
        // For LM Studio /api/v1/chat, these external tools won't be sent automatically 
        // unless they are configured in LM Studio or we find a way to pass them.
        return this.bind({ tools, ...kwargs });
    }
    async _generate(messages, options, runManager) {
        var _a;
        const systemMessage = messages.find((msg) => msg instanceof messages_1.SystemMessage);
        const chatMessages = messages.filter((msg) => !(msg instanceof messages_1.SystemMessage));
        // Improved history reconstruction to include tool call context
        const inputString = chatMessages.map((msg) => {
            let roleLabel = '';
            let content = msg.content;
            if (msg instanceof messages_1.HumanMessage)
                roleLabel = 'User';
            else if (msg instanceof messages_1.AIMessage) {
                roleLabel = 'Assistant';
                // If the message contains tool calls, represent them in the history string
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    const toolText = msg.tool_calls.map(tc => `[Calls Tool: ${tc.name} with args: ${JSON.stringify(tc.args)}]`).join('\n');
                    content = content ? `${content}\n${toolText}` : toolText;
                }
            }
            else if (msg instanceof messages_1.ToolMessage)
                roleLabel = 'Tool Output';
            else if (msg instanceof messages_1.ChatMessage)
                roleLabel = msg.role;
            return `${roleLabel}: ${content}`;
        }).join('\n\n');
        const payload = {
            model: this.modelName,
            input: inputString,
            integrations: this.integrations,
            stream: false,
        };
        if (systemMessage) {
            payload.system_prompt = systemMessage.content;
        }
        // Apply LLM parameters
        if (this.temperature !== undefined)
            payload.temperature = this.temperature;
        if (this.maxTokens !== undefined)
            payload.max_output_tokens = this.maxTokens;
        if (this.topP !== undefined)
            payload.top_p = this.topP;
        if (this.topK !== undefined)
            payload.top_k = this.topK;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/v1/chat`, payload, {
                headers,
                timeout: 120000,
            });
            const responseData = response.data;
            const generations = this._convertResponseToGenerations(responseData);
            return {
                generations,
                llmOutput: responseData.stats,
            };
        }
        catch (error) {
            const errorDetails = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) ? JSON.stringify(error.response.data) : error.message;
            console.error('Error calling LM Studio API:', errorDetails);
            throw new Error(`Failed to call LM Studio API: ${errorDetails}`);
        }
    }
    _convertResponseToGenerations(response) {
        let textContent = '';
        const toolResults = [];
        const toolCalls = [];
        if (response.output && Array.isArray(response.output)) {
            for (const item of response.output) {
                if (item.type === 'message') {
                    textContent += item.content;
                }
                else if (item.type === 'tool_call') {
                    // LM Studio executed the tool internally if 'output' is present
                    if (item.output) {
                        toolResults.push({
                            tool: item.tool,
                            output: item.output
                        });
                    }
                    else {
                        // It's a request for tool execution (unlikely with MCP enabled)
                        toolCalls.push({
                            name: item.tool,
                            args: item.arguments,
                            id: `call_${item.tool}_${Date.now()}`
                        });
                    }
                }
            }
        }
        // If tools were used internally, we might want to append their result to the text 
        // or just let them be logged in the console for now.
        // The final 'message' from LM Studio usually summarizes the tool output already.
        const generation = {
            text: textContent,
            message: new messages_1.AIMessage({
                content: textContent,
            }),
        };
        if (toolCalls.length > 0) {
            generation.message.tool_calls = toolCalls;
        }
        return [generation];
    }
}
exports.McpChatModel = McpChatModel;
