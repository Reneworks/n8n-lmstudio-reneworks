import {
    BaseChatModel,
    BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import {
    AIMessage,
    BaseMessage,
    ChatMessage,
    SystemMessage,
    HumanMessage,
    ToolMessage,
} from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import axios from 'axios';

export interface McpChatModelInput extends BaseChatModelParams {
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    integrations?: string; // JSON string
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
}

export class McpChatModel extends BaseChatModel {
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    integrations?: any[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;

    constructor(fields: McpChatModelInput) {
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
        } catch (e) {
            console.error('Failed to parse integrations JSON', e);
            this.integrations = [];
        }
    }

    _llmType(): string {
        return 'lmstudio_chat_model';
    }

    bindTools(tools: any[], kwargs?: any) {
        // n8n/LangChain will see the model supports tools.
        // For LM Studio /api/v1/chat, these external tools won't be sent automatically 
        // unless they are configured in LM Studio or we find a way to pass them.
        return this.bind({ tools, ...kwargs });
    }

    async _generate(
        messages: BaseMessage[],
        options: this['ParsedCallOptions'],
        runManager?: CallbackManagerForLLMRun
    ): Promise<ChatResult> {
        const systemMessage = messages.find((msg) => msg instanceof SystemMessage);
        const chatMessages = messages.filter((msg) => !(msg instanceof SystemMessage));

        // Improved history reconstruction to include tool call context
        const inputString = chatMessages.map((msg) => {
            let roleLabel = '';
            let content = msg.content;

            if (msg instanceof HumanMessage) roleLabel = 'User';
            else if (msg instanceof AIMessage) {
                roleLabel = 'Assistant';
                // If the message contains tool calls, represent them in the history string
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    const toolText = msg.tool_calls.map(tc => `[Calls Tool: ${tc.name} with args: ${JSON.stringify(tc.args)}]`).join('\n');
                    content = content ? `${content}\n${toolText}` : toolText;
                }
            }
            else if (msg instanceof ToolMessage) roleLabel = 'Tool Output';
            else if (msg instanceof ChatMessage) roleLabel = msg.role;

            return `${roleLabel}: ${content}`;
        }).join('\n\n');

        const payload: any = {
            model: this.modelName,
            input: inputString,
            integrations: this.integrations,
            stream: false,
        };

        if (systemMessage) {
            payload.system_prompt = systemMessage.content;
        }

        // Apply LLM parameters
        if (this.temperature !== undefined) payload.temperature = this.temperature;
        if (this.maxTokens !== undefined) payload.max_output_tokens = this.maxTokens;
        if (this.topP !== undefined) payload.top_p = this.topP;
        if (this.topK !== undefined) payload.top_k = this.topK;

        const headers: any = {
            'Content-Type': 'application/json',
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        try {
            const response = await axios.post(`${this.baseUrl}/api/v1/chat`, payload, {
                headers,
                timeout: 120000,
            });

            const responseData = response.data;
            const generations = this._convertResponseToGenerations(responseData);

            return {
                generations,
                llmOutput: responseData.stats,
            };
        } catch (error: any) {
            const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error('Error calling LM Studio API:', errorDetails);
            throw new Error(`Failed to call LM Studio API: ${errorDetails}`);
        }
    }

    _convertResponseToGenerations(response: any): any[] {
        let textContent = '';
        const toolResults: any[] = [];
        const toolCalls: any[] = [];

        if (response.output && Array.isArray(response.output)) {
            for (const item of response.output) {
                if (item.type === 'message') {
                    textContent += item.content;
                } else if (item.type === 'tool_call') {
                    // LM Studio executed the tool internally if 'output' is present
                    if (item.output) {
                        toolResults.push({
                            tool: item.tool,
                            output: item.output
                        });
                    } else {
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

        const generation: any = {
            text: textContent,
            message: new AIMessage({
                content: textContent,
            }),
        };

        if (toolCalls.length > 0) {
            generation.message.tool_calls = toolCalls;
        }

        return [generation];
    }
}
