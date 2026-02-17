import { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
export declare class McpChatModel implements INodeType {
    description: INodeTypeDescription;
    supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData>;
}
