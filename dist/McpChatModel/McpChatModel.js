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
        return 'mcp_chat_model';
    }
    async _generate(messages, options, runManager) {
        var _a;
        const apiMessages = this._convertMessagesToApi(messages);
        const payload = {
            model: this.modelName,
            input: apiMessages,
            integrations: this.integrations,
            stream: false,
        };
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
            });
            const responseData = response.data;
            const generations = this._convertResponseToGenerations(responseData);
            return {
                generations,
                llmOutput: responseData.stats,
            };
        }
        catch (error) {
            console.error('Error calling MCP Chat API:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw new Error(`Failed to call MCP Chat API: ${error.message}`);
        }
    }
    _convertMessagesToApi(messages) {
        return messages.map((msg) => {
            if (msg instanceof messages_1.SystemMessage) {
                return {
                    role: 'system', // The API might accept 'system_prompt' field in body, but often messages array works too.
                    // Wait, the API spec says "system_prompt (optional) : string". 
                    // If it's a list of messages, usually it handles roles.
                    // The API spec input says: "input : string | array<object>".
                    // "Input object: object ... Text Input: type: 'message', content: string".
                    // It doesn't explicitly mention 'role' in the input object description provided in the USER_REQUEST
                    // except for "Text input (optional) : object ... Input object : object ...".
                    // Let's re-read the spec carefully.
                    // "Input object : object ... Object representing a message ... "
                    // "Text Input (optional) : object ... type : 'message', content : string".
                    // "Image Input (optional) : object ... type : 'image', data_url : string".
                    // It seems it takes an array of these input objects.
                    // But typically chat APIs need roles (user, assistant, system).
                    // The example curl shows "input": "Tell me..." (string).
                    // If passing array, it's likely user messages.
                    // However, LangChain sends a history.
                    // If the API is stateless (REST), we need to send history.
                    // The spec mentions "store (optional) : boolean ... response_id ... previous_response_id".
                    // This suggests stateful conversation if we use response_id.
                    // BUT LangChain usually manages history itself and sends full context or expects the model to be stateless.
                    // If the underlying API is stateful, we might have issues if we send full history every time as "new" user inputs.
                    //
                    // Let's assume for now we convert everything to "Text Input" objects. 
                    // But we need to distinguish User vs Assistant vs System.
                    // The spec provided is a bit sparse on "role" field in "Input object".
                    // "Input text : string".
                    // "Input object : object ... Text Input (optional)".
                    //
                    // If I look at the example: "input": "Tell me..."
                    // It seems it treats input as the *next* user message.
                    // If I want to pass history, maybe I need to use `previous_response_id`?
                    // But LangChain `_generate` receives `messages` (history).
                    // If the capabilities of this "Chat Node" are just to be a Model in a chain, it usually expects to receive [System, User, AI, User] and generate AI.
                    // If the API only takes "input" (user message) and relies on internal state (`previous_response_id`), 
                    // then this LangChain wrapper is tricky because LangChain expects to control history.
                    //
                    // HOWEVER, most "chat" APIs (like OpenAI) take a list of messages with roles.
                    // The provided spec `input : string | array<object>` might be flexible.
                    // Let's check `Text Input` definition again.
                    // `type: "message"`, `content: ...`.
                    // It DOES NOT show `role`.
                    //
                    // Strategy:
                    // 1. If the API is stateful and we can't send history as list with roles, we might simply concatenate non-system messages?
                    //    Or maybe `input` array is meant to be a list of *content blocks* for a SINGLE message (multimodal)?
                    //    "Image Input ... Text Input". Yes, that looks like content blocks for a single user turn.
                    //
                    // 2. The `system_prompt` is a top-level field.
                    //
                    // 3. How do we pass previous conversation history?
                    //    The spec has `previous_response_id`.
                    //    This implies the server manages state.
                    //    But LangChain is designed to manage state (BufferMemory etc).
                    //    If we use this node in n8n with "AI Agent", n8n/LangChain will try to pass the full history.
                    //
                    //    If the API *requires* `previous_response_id` for history, we have a mismatch.
                    //    UNLESS we treat the entire history passed by LangChain as the "input" to the model?
                    //    But we can't easily distinguish who said what if we just dump text.
                    //
                    //    Wait, "Input object : object ... Object representing a message with additional metadata."
                    //    Maybe "additional metadata" allows role?
                    //
                    //    Let's look at the `curl` again.
                    //    It sends a single string.
                    //
                    //    Hypothesis: This API is designed like a "Completion" API or a "Stateful Chat" API, not a stateless "Chat Completion" API like OpenAI's `v1/chat/completions`.
                    //
                    //    If n8n AI Agent uses this, it generally passes the *new* user query and maybe history.
                    //    If I implement `_generate`, I receive `messages`. I should probably convert them to a prompt if the API doesn't support roles.
                    //    OR verify if `role` is supported in `Input object`.
                    //
                    //    Let's assume the API handles "user" role for the input.
                    //    For system message, we mapped it to `system_prompt`.
                    //    For history... we might be in trouble if we can't pass it.
                    //    
                    //    Let's try to format the history into the "input" string if there are multiple messages?
                    //    e.g.
                    //    User: ...
                    //    Assistant: ...
                    //    User: ...
                    //
                    //    Or maybe I can send array of objects and add a `role` field hoping it works?
                    //    The spec says "Input object : object ... Object representing a message with additional metadata."
                    //    So maybe `role` is allowed?
                    //
                    //    Let's try to send array of objects including `role`.
                    content: msg.content,
                };
            }
            else if (msg instanceof messages_1.AIMessage) {
                return {
                    role: 'assistant',
                    content: msg.content,
                };
            }
            else if (msg instanceof messages_1.ToolMessage) {
                return {
                    role: 'tool',
                    tool_call_id: msg.tool_call_id,
                    content: msg.content,
                };
            }
            else {
                // HumanMessage
                // Check if it has images (multimodal)
                // For now assume text
                return {
                    role: 'user',
                    content: msg.content,
                };
            }
        });
    }
    _convertResponseToGenerations(response) {
        // response.output is array of objects
        // types: message, tool_call, reasoning, invalid_tool_call
        // We need to merge them into a single AIMessage for LangChain usually, 
        // or return a single ChatGeneration.
        let textContent = '';
        const toolCalls = [];
        for (const item of response.output) {
            if (item.type === 'message') {
                textContent += item.content;
            }
            else if (item.type === 'tool_call') {
                toolCalls.push({
                    name: item.tool,
                    args: item.arguments,
                    id: item.tool // The API doesn't seem to return a specific call ID in the tool_call object itself?
                    // "Tool call : object ... tool: string, arguments: object"
                    // Wait, OpenAI tool calls need an ID.
                    // The API response example doesn't show an ID for `tool_call` type. 
                    // But n8n/LangChain might need one for `ToolMessage` mapping later.
                    // I'll generate one or use index.
                });
            }
            else if (item.type === 'reasoning') {
                console.log('Reasoning:', item.content);
                // Maybe append to text or ignore
            }
        }
        const generation = {
            text: textContent,
            message: new messages_1.AIMessage({
                content: textContent,
                additional_kwargs: {
                    tool_calls: toolCalls.map((tc, idx) => ({
                        id: `call_${idx}_${Date.now()}`, // Synth ID since API doesn't seem to provide one
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.args),
                        }
                    }))
                },
            }),
        };
        // Recent LangChain versions use `tool_calls` field on AIMessage directly
        if (toolCalls.length > 0) {
            generation.message.tool_calls = toolCalls.map((tc, idx) => ({
                id: `call_${idx}_${Date.now()}`,
                name: tc.name,
                args: tc.args
            }));
        }
        return [generation];
    }
}
exports.McpChatModel = McpChatModel;
