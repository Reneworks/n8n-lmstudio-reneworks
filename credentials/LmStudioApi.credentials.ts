import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class LmStudioApi implements ICredentialType {
    name = 'lmStudioApi';
    displayName = 'LM Studio API';
    documentationUrl = 'https://lmstudio.ai/docs/developer/core/authentication';

    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            description:
                'Opcional. Token de acceso configurado en el servidor local de LM Studio (Developer > Server > API). Déjalo vacío si el servidor no requiere autenticación.',
        },
    ];
}
