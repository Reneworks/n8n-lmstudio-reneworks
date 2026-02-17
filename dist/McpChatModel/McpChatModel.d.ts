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
    _generate(messages: BaseMessage[], options: this['ParsedCallOptions'], runManager?: CallbackManagerForLLMRun): Promise<ChatResult>;
    _convertMessagesToApi(messages: BaseMessage[]): any[];
    _convertResponseToGenerations(response: any): any[];
}
