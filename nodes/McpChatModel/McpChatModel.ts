import {
    BaseChatModel,
    BaseChatModelCallOptions,
    BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import {
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    ChatMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from '@langchain/core/messages';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { ChatGeneration, ChatGenerationChunk, ChatResult } from '@langchain/core/outputs';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import axios from 'axios';
import * as readline from 'readline';

export type LmStudioApiMode = 'native' | 'chat' | 'responses';

export interface McpChatModelCallOptions extends BaseChatModelCallOptions {
    tools?: any[];
    streaming?: boolean;
}

export interface McpChatModelInput extends BaseChatModelParams {
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    mode?: LmStudioApiMode;
    integrations?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    minP?: number;
    repeatPenalty?: number;
    seed?: number;
    stop?: string | string[];
    presencePenalty?: number;
    frequencyPenalty?: number;
    contextLength?: number;
    reasoning?: string;
    jsonMode?: boolean;
    responseSchema?: string;
}

interface SseEvent {
    event?: string | null;
    data: string;
}

function contentToString(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((c: any) => {
                if (c && typeof c === 'object' && typeof c.text === 'string') {
                    return c.text;
                }
                if (c && typeof c === 'object' && typeof c.content === 'string') {
                    return c.content;
                }
                return typeof c === 'string' ? c : JSON.stringify(c);
            })
            .join('');
    }
    if (content === undefined || content === null) {
        return '';
    }
    return String(content);
}

function safeJsonParse(value: string, fallback: any = {}): any {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function getEndpoint(baseUrl: string, mode: LmStudioApiMode): string {
    if (mode === 'native') {
        return `${baseUrl.replace(/\/+$/, '')}/api/v1/chat`;
    }
    if (mode === 'responses') {
        return `${baseUrl.replace(/\/+$/, '')}/v1/responses`;
    }
    return `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
}

function convertTools(tools: any[]): any[] {
    if (!tools || !tools.length) {
        return [];
    }
    return tools.map((tool) => {
        if (tool && tool.type === 'function' && tool.function) {
            return tool;
        }
        try {
            return convertToOpenAITool(tool);
        } catch {
            return tool;
        }
    });
}

function messageRole(msg: BaseMessage): string {
    if (msg instanceof SystemMessage) {
        return 'system';
    }
    if (msg instanceof HumanMessage) {
        return 'user';
    }
    if (msg instanceof AIMessage) {
        return 'assistant';
    }
    if (msg instanceof ToolMessage) {
        return 'tool';
    }
    if (msg instanceof ChatMessage) {
        return msg.role;
    }
    return msg._getType();
}

function historyToText(messages: BaseMessage[]): string {
    const system = messages.find((m) => m instanceof SystemMessage);
    const rest = messages.filter((m) => !(m instanceof SystemMessage));

    const inputString = rest
        .map((msg) => {
            let roleLabel = '';
            let content = contentToString(msg.content);

            if (msg instanceof HumanMessage) {
                roleLabel = 'User';
            } else if (msg instanceof AIMessage) {
                roleLabel = 'Assistant';
                const tc = (msg as AIMessage).tool_calls;
                if (tc && tc.length > 0) {
                    const toolText = tc
                        .map((t) => `[Calls Tool: ${t.name} with args: ${JSON.stringify(t.args)}]`)
                        .join('\n');
                    content = content ? `${content}\n${toolText}` : toolText;
                }
            } else if (msg instanceof ToolMessage) {
                roleLabel = 'Tool Output';
            } else if (msg instanceof ChatMessage) {
                roleLabel = msg.role;
            }

            return `${roleLabel}: ${content}`;
        })
        .join('\n\n');

    if (system) {
        return `System: ${contentToString(system.content)}\n\n${inputString}`;
    }
    return inputString;
}

function openAiMessages(messages: BaseMessage[]): any[] {
    return messages.map((msg) => {
        const content = contentToString(msg.content);
        if (msg instanceof ToolMessage) {
            return {
                role: 'tool',
                content,
                tool_call_id: (msg as ToolMessage).tool_call_id,
            };
        }
        if (msg instanceof AIMessage) {
            const ai = msg as AIMessage;
            if (ai.tool_calls && ai.tool_calls.length) {
                return {
                    role: 'assistant',
                    content: content || null,
                    tool_calls: ai.tool_calls.map((tc) => ({
                        id: tc.id || `call_${Date.now()}`,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.args ?? {}),
                        },
                    })),
                };
            }
            return { role: 'assistant', content };
        }
        return { role: messageRole(msg), content };
    });
}

function responsesInput(messages: BaseMessage[]): any[] {
    return messages.map((msg) => {
        const content = contentToString(msg.content);
        if (msg instanceof ToolMessage) {
            return {
                type: 'function_call_output',
                call_id: (msg as ToolMessage).tool_call_id || `call_${Date.now()}`,
                output: content,
            };
        }
        if (msg instanceof SystemMessage) {
            return { role: 'system', content: [{ type: 'input_text', text: content }] };
        }
        if (msg instanceof AIMessage) {
            const ai = msg as AIMessage;
            const item: any = {
                role: 'assistant',
                content: [{ type: 'output_text', text: content }],
            };
            if (ai.tool_calls && ai.tool_calls.length) {
                item.function_calls = ai.tool_calls.map((tc) => ({
                    call_id: tc.id || `call_${Date.now()}`,
                    name: tc.name,
                    arguments: JSON.stringify(tc.args ?? {}),
                }));
            }
            return item;
        }
        return { role: 'user', content: [{ type: 'input_text', text: content }] };
    });
}

export interface McpChatModelFields extends BaseChatModelParams {
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    mode?: LmStudioApiMode;
    integrations?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    minP?: number;
    repeatPenalty?: number;
    seed?: number;
    stop?: string | string[];
    presencePenalty?: number;
    frequencyPenalty?: number;
    contextLength?: number;
    reasoning?: string;
    jsonMode?: boolean;
    responseSchema?: string;
}

export class McpChatModel extends BaseChatModel<McpChatModelCallOptions> {
    private baseUrl: string;
    private modelName: string;
    private apiKey?: string;
    private mode: LmStudioApiMode;
    private integrations: any[];
    private temperature?: number;
    private maxTokens?: number;
    private topP?: number;
    private topK?: number;
    private minP?: number;
    private repeatPenalty?: number;
    private seed?: number;
    private stop?: string | string[];
    private presencePenalty?: number;
    private frequencyPenalty?: number;
    private contextLength?: number;
    private reasoning?: string;
    private jsonMode?: boolean;
    private responseSchema?: string;
    private tools: any[] = [];

    constructor(fields: McpChatModelFields) {
        super(fields);
        this.baseUrl = fields.baseUrl;
        this.modelName = fields.modelName;
        this.apiKey = fields.apiKey;
        this.mode = fields.mode ?? 'native';
        this.temperature = fields.temperature;
        this.maxTokens = fields.maxTokens;
        this.topP = fields.topP;
        this.topK = fields.topK;
        this.minP = fields.minP;
        this.repeatPenalty = fields.repeatPenalty;
        this.seed = fields.seed;
        this.stop = fields.stop;
        this.presencePenalty = fields.presencePenalty;
        this.frequencyPenalty = fields.frequencyPenalty;
        this.contextLength = fields.contextLength;
        this.reasoning = fields.reasoning;
        this.jsonMode = fields.jsonMode;
        this.responseSchema = fields.responseSchema;

        try {
            this.integrations = fields.integrations ? JSON.parse(fields.integrations) : [];
        } catch (e) {
            console.error('[mcpChatModel] Failed to parse integrations JSON', e);
            this.integrations = [];
        }
    }

    _llmType(): string {
        return 'lmstudio_chat_model';
    }

    bindTools(tools: any[], kwargs?: Record<string, unknown>) {
        this.tools = tools ?? [];
        return this;
    }

    async getNumTokens(content: string): Promise<number> {
        return Math.ceil((content || '').length / 4);
    }

    private toolsFromOptions(options: McpChatModelCallOptions): any[] {
        if (options && options.tools && options.tools.length) {
            return options.tools;
        }
        return this.tools;
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return headers;
    }

    private get commonPayload(): Record<string, unknown> {
        const payload: Record<string, unknown> = {};
        if (this.temperature !== undefined) payload.temperature = this.temperature;
        if (this.topP !== undefined) payload.top_p = this.topP;
        if (this.topK !== undefined) payload.top_k = this.topK;
        if (this.minP !== undefined) payload.min_p = this.minP;
        if (this.repeatPenalty !== undefined) payload.repeat_penalty = this.repeatPenalty;
        if (this.seed !== undefined) payload.seed = this.seed;
        if (this.contextLength !== undefined) payload.context_length = this.contextLength;
        if (this.reasoning !== undefined) payload.reasoning = this.reasoning;
        return payload;
    }

    private buildPayload(messages: BaseMessage[], stream: boolean, tools: any[]): any {
        const url = getEndpoint(this.baseUrl, this.mode);
        if (!this.modelName) {
            throw new Error('Model is required. Select a model from the dropdown.');
        }

        if (this.mode === 'native') {
            if (tools && tools.length) {
                throw new Error(
                    'LM Studio Native mode (/api/v1/chat) does not support custom tools. Use "OpenAI Chat Completions" or "OpenAI Responses" mode to use tools in your AI Agent.'
                );
            }
            const payload: any = {
                model: this.modelName,
                input: historyToText(messages),
                integrations: this.integrations,
                stream,
            };
            const system = messages.find((m) => m instanceof SystemMessage);
            if (system) {
                payload.system_prompt = contentToString(system.content);
            }
            if (this.maxTokens !== undefined) payload.max_output_tokens = this.maxTokens;
            this.applyCommon(payload);
            return { payload, url };
        }

        if (this.mode === 'responses') {
            const payload: any = {
                model: this.modelName,
                input: responsesInput(messages),
                stream,
            };
            const toolsOut = convertTools(tools);
            const mcpTools: any[] = [];
            for (const i of this.integrations) {
                if (i && i.type === 'ephemeral_mcp') {
                    mcpTools.push({
                        type: 'mcp',
                        server_label: i.server_label,
                        server_url: i.server_url,
                        allowed_tools: i.allowed_tools,
                    });
                }
            }
            if (toolsOut.length || mcpTools.length) {
                payload.tools = [...toolsOut, ...mcpTools];
            }
            if (this.maxTokens !== undefined) payload.max_output_tokens = this.maxTokens;
            this.applyCommon(payload);
            if (this.jsonMode) {
                payload.text = {
                    format: this.responseSchema
                        ? {
                              type: 'json_schema',
                              name: safeJsonParse(this.responseSchema, {}).name || 'response',
                              schema: safeJsonParse(this.responseSchema, {}),
                          }
                        : { type: 'json_object' },
                };
            }
            return { payload, url };
        }

        // chat (OpenAI Chat Completions)
        const payload: any = {
            model: this.modelName,
            messages: openAiMessages(messages),
            stream,
        };
        const toolsOut = convertTools(tools);
        if (toolsOut.length) {
            payload.tools = toolsOut;
            payload.tool_choice = 'auto';
        }
        if (this.maxTokens !== undefined) payload.max_tokens = this.maxTokens;
        if (this.stop !== undefined)
            payload.stop = Array.isArray(this.stop) ? this.stop : this.stop.split(',').map((s) => s.trim());
        if (this.presencePenalty !== undefined) payload.presence_penalty = this.presencePenalty;
        if (this.frequencyPenalty !== undefined) payload.frequency_penalty = this.frequencyPenalty;
        this.applyCommon(payload);
        if (this.jsonMode) {
            payload.response_format = this.responseSchema
                ? {
                      type: 'json_schema',
                      json_schema: {
                          name: (safeJsonParse(this.responseSchema, {}).name as string) || 'response',
                          strict: true,
                          schema: safeJsonParse(this.responseSchema, {}),
                      },
                  }
                : { type: 'json_object' };
        }
        return { payload, url };
    }

    private applyCommon(payload: Record<string, unknown>): void {
        const p = this.commonPayload;
        for (const key of Object.keys(p)) {
            payload[key] = p[key];
        }
    }

    async _generate(
        messages: BaseMessage[],
        options: this['ParsedCallOptions'],
        runManager?: CallbackManagerForLLMRun
    ): Promise<ChatResult> {
        const opts = (options ?? {}) as McpChatModelCallOptions;
        const tools = this.toolsFromOptions(opts);

        if (opts.streaming) {
            const chunks: string[] = [];
            const toolCalls: any[] = [];
            for await (const chunk of this.streamChunks(messages, opts)) {
                if (chunk.text) {
                    chunks.push(chunk.text);
                    void runManager?.handleLLMNewToken(chunk.text);
                }
                const msg = chunk.message as AIMessageChunk;
                if (msg && msg.tool_calls && msg.tool_calls.length) {
                    toolCalls.push(...msg.tool_calls);
                }
            }
            const text = chunks.join('');
            const generation: ChatGeneration = {
                text,
                message: new AIMessage({ content: text, tool_calls: toolCalls.length ? toolCalls : undefined }),
            };
            return { generations: [generation], llmOutput: {} };
        }

        const { payload, url } = this.buildPayload(messages, false, tools);
        let responseData: any;
        try {
            const response = await axios.post(url, payload, {
                headers: this.buildHeaders(),
                timeout: 120000,
            });
            responseData = response.data;
        } catch (error: any) {
            const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Failed to call LM Studio API (${this.mode}): ${errorDetails}`);
        }

        const generation = this.convertResponseToGeneration(responseData);
        return {
            generations: [generation],
            llmOutput: this.extractStats(responseData),
        };
    }

    async *_streamResponseChunks(
        messages: BaseMessage[],
        options: this['ParsedCallOptions'],
        runManager?: CallbackManagerForLLMRun
    ): AsyncGenerator<ChatGenerationChunk> {
        const opts = (options ?? {}) as McpChatModelCallOptions;
        const tools = this.toolsFromOptions(opts);
        yield* this.streamChunks(messages, opts);
    }

    private async *streamChunks(
        messages: BaseMessage[],
        options: McpChatModelCallOptions
    ): AsyncGenerator<ChatGenerationChunk> {
        const tools = this.toolsFromOptions(options);
        const { payload, url } = this.buildPayload(messages, true, tools);

        let response;
        try {
            response = await axios.post(url, payload, {
                headers: this.buildHeaders(),
                responseType: 'stream',
                timeout: 120000,
            });
        } catch (error: any) {
            const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Failed to stream from LM Studio API (${this.mode}): ${errorDetails}`);
        }

        if (this.mode === 'native') {
            yield* this.consumeNativeStream(response.data);
        } else if (this.mode === 'responses') {
            yield* this.consumeResponsesStream(response.data);
        } else {
            yield* this.consumeChatStream(response.data);
        }
    }

    private async *consumeNativeStream(stream: any): AsyncGenerator<ChatGenerationChunk> {
        for await (const evt of this.readSse(stream)) {
            if (evt.event === 'message.delta') {
                const content = evt.data ? safeJsonParse(evt.data, {}).content : '';
                if (content) {
                    yield new ChatGenerationChunk({ text: content, message: new AIMessageChunk({ content }) });
                }
            }
            if (evt.event === 'error') {
                const err = evt.data ? safeJsonParse(evt.data, {}).error : null;
                if (err && err.message) {
                    throw new Error(`LM Studio streaming error: ${err.message}`);
                }
            }
        }
    }

    private async *consumeChatStream(stream: any): AsyncGenerator<ChatGenerationChunk> {
        const accumulatedToolCalls: Record<number, any> = {};
        for await (const evt of this.readSse(stream)) {
            if (evt.data === '[DONE]') {
                break;
            }
            if (!evt.data) {
                continue;
            }
            let chunk: any;
            try {
                chunk = JSON.parse(evt.data);
            } catch {
                continue;
            }
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
            if (!delta) {
                continue;
            }
            if (delta.content) {
                yield new ChatGenerationChunk({
                    text: delta.content,
                    message: new AIMessageChunk({ content: delta.content }),
                });
            }
            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                    const index = tc.index ?? 0;
                    accumulatedToolCalls[index] = accumulatedToolCalls[index] || {
                        id: tc.id || '',
                        name: '',
                        arguments: '',
                    };
                    if (tc.id) accumulatedToolCalls[index].id = tc.id;
                    if (tc.function) {
                        if (tc.function.name) accumulatedToolCalls[index].name += tc.function.name;
                        if (tc.function.arguments) accumulatedToolCalls[index].arguments += tc.function.arguments;
                    }
                }
            }
        }
        const toolCalls = Object.values(accumulatedToolCalls)
            .filter((tc: any) => tc.name)
            .map((tc: any) => ({
                name: tc.name,
                id: tc.id || `call_${Date.now()}`,
                args: safeJsonParse(tc.arguments, {}),
            }));
        if (toolCalls.length) {
            yield new ChatGenerationChunk({
                text: '',
                message: new AIMessageChunk({ content: '', tool_calls: toolCalls }),
            });
        }
    }

    private async *consumeResponsesStream(stream: any): AsyncGenerator<ChatGenerationChunk> {
        const functionCalls: Record<string, any> = {};
        const order: string[] = [];
        for await (const evt of this.readSse(stream)) {
            if (!evt.data) {
                continue;
            }
            let data: any;
            try {
                data = JSON.parse(evt.data);
            } catch {
                continue;
            }
            const type = data.type || evt.event;
            if (type === 'response.output_text.delta' && data.delta) {
                yield new ChatGenerationChunk({
                    text: data.delta,
                    message: new AIMessageChunk({ content: data.delta }),
                });
            }
            if (type === 'response.function_call_arguments.delta' && data.delta) {
                const key = data.item_id || data.call_id || 'call_0';
                if (!functionCalls[key]) {
                    order.push(key);
                    functionCalls[key] = { name: data.name || '', id: data.item_id || key, arguments: '' };
                }
                functionCalls[key].arguments += data.delta;
            }
            if (type === 'response.function_call_arguments.done') {
                const key = data.item_id || data.call_id || 'call_0';
                functionCalls[key] = functionCalls[key] || {
                    name: data.name || '',
                    id: data.item_id || key,
                    arguments: '',
                };
                functionCalls[key].arguments = data.arguments || functionCalls[key].arguments;
            }
        }
        const toolCalls = order
            .map((k) => functionCalls[k])
            .filter((fc: any) => fc.name)
            .map((fc: any) => ({
                name: fc.name,
                id: fc.id || `call_${fc.name}_${Date.now()}`,
                args: safeJsonParse(fc.arguments, {}),
            }));
        if (toolCalls.length) {
            yield new ChatGenerationChunk({
                text: '',
                message: new AIMessageChunk({ content: '', tool_calls: toolCalls }),
            });
        }
    }

    private async *readSse(stream: any): AsyncGenerator<SseEvent> {
        const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
        let event: string | null = null;
        let dataLines: string[] = [];
        for await (const line of lines) {
            if (line === '') {
                if (dataLines.length) {
                    yield { event, data: dataLines.join('\n') };
                }
                event = null;
                dataLines = [];
            } else if (line.startsWith('event:')) {
                event = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
            }
        }
        if (dataLines.length) {
            yield { event, data: dataLines.join('\n') };
        }
    }

    convertResponseToGeneration(response: any): ChatGeneration {
        let textContent = '';
        let toolCalls: any[] = [];

        if (this.mode === 'native') {
            textContent = '';
            const toolResults: any[] = [];
            const requestToolCalls: any[] = [];
            if (response.output && Array.isArray(response.output)) {
                for (const item of response.output) {
                    if (item.type === 'message') {
                        textContent += item.content || '';
                    } else if (item.type === 'tool_call') {
                        if (item.output) {
                            toolResults.push({ tool: item.tool, output: item.output });
                        } else {
                            requestToolCalls.push({
                                name: item.tool,
                                args: item.arguments,
                                id: `call_${item.tool}_${Date.now()}`,
                            });
                        }
                    } else if (item.type === 'reasoning') {
                        // Reasoning content is available but not part of the final text output.
                    } else if (item.type === 'invalid_tool_call') {
                        textContent += `\n[Invalid tool call: ${item.tool_name || 'unknown'}]`;
                    }
                }
            }
            if (toolResults.length) {
                textContent = textContent
                    ? textContent
                    : `${toolResults.map((t) => `[Tool: ${t.tool} -> ${t.output}]`).join('\n')}`;
            }
            toolCalls = requestToolCalls;
        } else if (this.mode === 'responses') {
            if (response.output && Array.isArray(response.output)) {
                for (const item of response.output) {
                    if (item.type === 'message') {
                        const content = contentToString(item.content);
                        textContent += content;
                    } else if (item.type === 'function_call') {
                        toolCalls.push({
                            name: item.name,
                            id: item.call_id || item.id || `call_${item.name}_${Date.now()}`,
                            args: safeJsonParse(item.arguments, {}),
                        });
                    }
                }
            }
        } else {
            const choice = response.choices && response.choices[0];
            const message = choice && choice.message;
            if (message) {
                textContent = contentToString(message.content);
                if (message.tool_calls && Array.isArray(message.tool_calls)) {
                    toolCalls = message.tool_calls.map((tc: any) => ({
                        name: tc.function && tc.function.name,
                        id: tc.id || `call_${Date.now()}`,
                        args: safeJsonParse(tc.function && tc.function.arguments, {}),
                    }));
                }
            }
        }

        const generation: ChatGeneration = {
            text: textContent,
            message: new AIMessage({
                content: textContent,
                tool_calls: toolCalls.length ? toolCalls : undefined,
            }),
        };
        return generation;
    }

    private extractStats(response: any): Record<string, unknown> {
        if (this.mode === 'native' && response.stats) {
            return response.stats;
        }
        if (response.usage) {
            return response.usage;
        }
        if (response.response_usage) {
            return response.response_usage;
        }
        return {};
    }
}
