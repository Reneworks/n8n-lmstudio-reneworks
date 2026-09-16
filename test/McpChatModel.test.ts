import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { ChatGeneration } from '@langchain/core/outputs';
import axios from 'axios';
import { McpChatModel } from '../nodes/McpChatModel/McpChatModel';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('McpChatModel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('native mode', () => {
        it('builds a native /api/v1/chat payload and parses the message output', async () => {
            mockedAxios.post.mockResolvedValue({
                data: {
                    model_instance_id: 'm',
                    output: [{ type: 'message', content: 'Hola, soy un modelo local.' }],
                    stats: { input_tokens: 10, total_output_tokens: 5 },
                },
            });

            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
                mode: 'native',
                integrations: JSON.stringify([
                    { type: 'ephemeral_mcp', server_label: 'hf', server_url: 'https://hf.co/mcp', allowed_tools: ['x'] },
                ]),
                temperature: 0.2,
            });

            const result = await model.generate([
                [new SystemMessage('You are helpful'), new HumanMessage('Hola')],
            ]);

            const [url, payload, config] = mockedAxios.post.mock.calls[0] as any;
            expect(url).toBe('http://localhost:1234/api/v1/chat');
            expect(payload.model).toBe('test/model');
            expect(payload.system_prompt).toBe('You are helpful');
            expect(payload.input).toContain('User: Hola');
            expect(payload.stream).toBe(false);
            expect(payload.temperature).toBe(0.2);
            expect(payload.integrations).toHaveLength(1);
            expect(config.headers['Authorization']).toBeUndefined();

            expect(result.generations[0][0].text).toBe('Hola, soy un modelo local.');
        });

        it('throws a clear error when tools are bound in native mode', async () => {
            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
                mode: 'native',
            });

            model.bindTools([{ name: 'fake', schema: { type: 'object', properties: {} } }]);

            await expect(model.generate([[new HumanMessage('Hello')]])).rejects.toThrow(/does not support custom tools/i);
        });
    });

    describe('chat completions mode', () => {
        it('sends an OpenAI-compatible messages array and returns tool calls parsed', async () => {
            mockedAxios.post.mockResolvedValue({
                data: {
                    model: 'test/model',
                    choices: [
                        {
                            finish_reason: 'tool_calls',
                            message: {
                                role: 'assistant',
                                content: null,
                                tool_calls: [
                                    {
                                        id: 'call_1',
                                        type: 'function',
                                        function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
                                    },
                                ],
                            },
                        },
                    ],
                    usage: { prompt_tokens: 5, completion_tokens: 3 },
                },
            });

            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
                mode: 'chat',
                apiKey: 'secret',
            });

            const result = await model.generate([[new HumanMessage('Weather in Paris?')]]);

            const [url, payload] = mockedAxios.post.mock.calls[0] as any;
            expect(url).toBe('http://localhost:1234/v1/chat/completions');
            expect(payload.messages).toEqual([{ role: 'user', content: 'Weather in Paris?' }]);
            expect(payload.stream).toBe(false);
            expect(payload.tools).toBeUndefined();

            const message = (result.generations[0][0] as ChatGeneration).message as AIMessage;
            expect(message.tool_calls).toHaveLength(1);
            expect(message.tool_calls![0].name).toBe('get_weather');
            expect(message.tool_calls![0].args).toEqual({ city: 'Paris' });
        });

        it('includes tools in the payload when tools are bound', async () => {
            mockedAxios.post.mockResolvedValue({
                data: {
                    choices: [{ message: { role: 'assistant', content: 'ok' } }],
                },
            });

            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
                mode: 'chat',
            });

            model.bindTools([
                {
                    type: 'function',
                    function: { name: 'get_time', description: 'Get the time', parameters: { type: 'object', properties: {} } },
                },
            ]);

            await model.generate([[new HumanMessage('What time is it?')]]);

            const payload = mockedAxios.post.mock.calls[0][1] as any;
            expect(payload.tools).toHaveLength(1);
            expect(payload.tools[0].function.name).toBe('get_time');
            expect(payload.tool_choice).toBe('auto');
        });

        it('sends tool messages with tool_call_id when executing the agent loop', async () => {
            mockedAxios.post.mockResolvedValue({
                data: { choices: [{ message: { role: 'assistant', content: 'The result is 42' } }] },
            });

            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
                mode: 'chat',
            });

            await model.generate([
                [
                    new HumanMessage('Chance me'),
                    new AIMessage({ content: '', tool_calls: [{ name: 'roll_dice', args: {}, id: 'call_123' }] }),
                    new ToolMessage({ content: '42', tool_call_id: 'call_123' }),
                ],
            ]);

            const payload = mockedAxios.post.mock.calls[0][1] as any;
            expect(payload.messages).toEqual([
                { role: 'user', content: 'Chance me' },
                {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        {
                            id: 'call_123',
                            type: 'function',
                            function: { name: 'roll_dice', arguments: '{}' },
                        },
                    ],
                },
                { role: 'tool', content: '42', tool_call_id: 'call_123' },
            ]);
        });
    });

    describe('responses mode', () => {
        it('parses message and function_call output into a ChatGeneration', () => {
            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
                mode: 'responses',
            });

            const generation = model.convertResponseToGeneration({
                output: [
                    {
                        type: 'function_call',
                        call_id: 'fc_1',
                        name: 'search',
                        arguments: '{"q":"LM Studio"}',
                    },
                    {
                        type: 'message',
                        role: 'assistant',
                        content: [{ type: 'output_text', text: 'Found results' }],
                    },
                ],
            });

            expect(generation.text).toBe('Found results');
            const message = generation.message as AIMessage;
            expect(message.tool_calls).toHaveLength(1);
            expect(message.tool_calls![0].name).toBe('search');
            expect(message.tool_calls![0].args).toEqual({ q: 'LM Studio' });
        });

        it('sends MCP integrations as tools of type mcp', async () => {
            mockedAxios.post.mockResolvedValue({
                data: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] },
            });

            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
                mode: 'responses',
                integrations: JSON.stringify([
                    { type: 'ephemeral_mcp', server_label: 'hf', server_url: 'https://hf.co/mcp', allowed_tools: ['model_search'] },
                ]),
            });

            await model.generate([[new HumanMessage('Busca')]]);

            const [url, payload] = mockedAxios.post.mock.calls[0] as any;
            expect(url).toBe('http://localhost:1234/v1/responses');
            expect(payload.tools).toEqual([
                {
                    type: 'mcp',
                    server_label: 'hf',
                    server_url: 'https://hf.co/mcp',
                    allowed_tools: ['model_search'],
                },
            ]);
        });
    });

    describe('getNumTokens', () => {
        it('estimates tokens from character count', async () => {
            const model = new McpChatModel({
                baseUrl: 'http://localhost:1234',
                modelName: 'test/model',
            });
            await expect(model.getNumTokens('hello world, four tokens')).resolves.toBe(6);
        });
    });
});