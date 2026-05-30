import { z } from 'zod';
import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import {
  createAccountGroupSchema,
  updateAccountGroupSchema,
} from '../schemas/siigo.schemas.js';
import { arrayOf, single, accountGroupSchema } from '../schemas/output.schemas.js';
import { RO, WRITE, run } from './_helpers.js';

export function registerAccountGroupTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  tools.set('siigo_list_account_groups', {
    name: 'siigo_list_account_groups',
    description:
      'Lista las categorías / grupos de inventario de Siigo. No recibe parámetros. SALIDA: array de categorías (id, name, active). Útil para clasificar productos al crearlos.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: arrayOf(accountGroupSchema, 'Listado de categorías de inventario.'),
    annotations: RO,
    handler: (args: any) =>
      run(z.object({}), args, 'Listing account groups', () =>
        client.get(SIIGO_ENDPOINTS.ACCOUNT_GROUPS)
      ),
  });

  if (!enableWrite) return;

  tools.set('siigo_create_account_group', {
    name: 'siigo_create_account_group',
    description:
      'Crea una categoría / grupo de inventario. Recibe el objeto `account_group` con la estructura del blueprint (name, ...). SALIDA: categoría creada. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        account_group: {
          type: 'object',
          description: 'Datos de la categoría de inventario (ver siigoapi.apib).',
        },
      },
      required: ['account_group'],
    },
    outputSchema: single(accountGroupSchema, 'Categoría creada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createAccountGroupSchema, args, 'Creating account group', ({ account_group }) =>
        client.post(SIIGO_ENDPOINTS.ACCOUNT_GROUPS, account_group)
      ),
  });

  tools.set('siigo_update_account_group', {
    name: 'siigo_update_account_group',
    description:
      'Actualiza una categoría / grupo de inventario existente. Recibe el ID (numérico) y el objeto `account_group` con los datos a actualizar. SALIDA: categoría actualizada. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID (numérico) de la categoría de inventario.' },
        account_group: { type: 'object', description: 'Datos a actualizar.' },
      },
      required: ['id', 'account_group'],
    },
    outputSchema: single(accountGroupSchema, 'Categoría actualizada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(updateAccountGroupSchema, args, 'Updating account group', ({ id, account_group }) =>
        client.put(SIIGO_ENDPOINTS.ACCOUNT_GROUP(id), account_group)
      ),
  });
}
