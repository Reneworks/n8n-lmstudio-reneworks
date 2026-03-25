import { BaseChatModel, BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { ChatResult } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
export interface McpChatModelInput extends BaseChatModelParams {
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    integrations?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
}
export declare class McpChatModel extends BaseChatModel {
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    integrations?: any[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    constructor(fields: McpChatModelInput);
    _llmType(): string;
    bindTools(tools: any[], kwargs?: any): import("@langchain/core/dist/runnables/base").Runnable<import("@langchain/core/dist/language_models/base").BaseLanguageModelInput, import("@langchain/core/messages").BaseMessageChunk, import("@langchain/core/dist/language_models/base").BaseLanguageModelCallOptions>;
    _generate(messages: BaseMessage[], options: this['ParsedCallOptions'], runManager?: CallbackManagerForLLMRun): Promise<ChatResult>;
    _convertResponseToGenerations(response: any): any[];
}
