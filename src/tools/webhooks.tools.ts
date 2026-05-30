import { z } from 'zod';
import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import {
  idParamSchema,
  createWebhookSchema,
  updateWebhookSchema,
} from '../schemas/siigo.schemas.js';
import { arrayOf, single, webhookSchema } from '../schemas/output.schemas.js';
import { RO, WRITE, DESTRUCTIVE, run } from './_helpers.js';

export function registerWebhookTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  tools.set('siigo_list_webhooks', {
    name: 'siigo_list_webhooks',
    description:
      'Lista los webhooks configurados en Siigo. No recibe parámetros. SALIDA: array de webhooks (id, url, application_id, company_key). Útil para auditar las suscripciones a eventos.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: arrayOf(webhookSchema, 'Listado de webhooks.'),
    annotations: RO,
    handler: (args: any) =>
      run(z.object({}), args, 'Listing webhooks', () => client.get(SIIGO_ENDPOINTS.WEBHOOKS)),
  });

  if (!enableWrite) return;

  tools.set('siigo_create_webhook', {
    name: 'siigo_create_webhook',
    description:
      'Crea un webhook. Recibe el objeto `webhook` con la estructura del blueprint (url, application_id, ...). SALIDA: webhook creado. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        webhook: { type: 'object', description: 'Datos del webhook (ver siigoapi.apib).' },
      },
      required: ['webhook'],
    },
    outputSchema: single(webhookSchema, 'Webhook creado.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createWebhookSchema, args, 'Creating webhook', ({ webhook }) =>
        client.post(SIIGO_ENDPOINTS.WEBHOOKS, webhook)
      ),
  });

  tools.set('siigo_update_webhook', {
    name: 'siigo_update_webhook',
    description:
      'Actualiza un webhook existente. Recibe el ID (GUID) y el objeto `webhook` con los datos a actualizar. SALIDA: webhook actualizado. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) del webhook.' },
        webhook: { type: 'object', description: 'Datos a actualizar.' },
      },
      required: ['id', 'webhook'],
    },
    outputSchema: single(webhookSchema, 'Webhook actualizado.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(updateWebhookSchema, args, 'Updating webhook', ({ id, webhook }) =>
        client.put(SIIGO_ENDPOINTS.WEBHOOK(id), webhook)
      ),
  });

  tools.set('siigo_delete_webhook', {
    name: 'siigo_delete_webhook',
    description:
      'Elimina un webhook por su ID (GUID). Operación destructiva. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del webhook.' } },
      required: ['id'],
    },
    annotations: DESTRUCTIVE,
    handler: (args: any) =>
      run(idParamSchema, args, 'Deleting webhook', ({ id }) =>
        client.delete(SIIGO_ENDPOINTS.WEBHOOK(id))
      ),
  });
}
