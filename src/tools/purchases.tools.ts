import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import {
  listPurchasesSchema,
  idParamSchema,
  createPurchaseSchema,
  updatePurchaseSchema,
} from '../schemas/siigo.schemas.js';
import { paginated, single, purchaseSchema } from '../schemas/output.schemas.js';
import { RO, WRITE, DESTRUCTIVE, pageProps, createdRangeProps, run } from './_helpers.js';

export function registerPurchaseTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  tools.set('siigo_list_purchases', {
    name: 'siigo_list_purchases',
    description:
      'Lista facturas de compra / gastos de Siigo (paginado). Filtros por fecha de creación/actualización. SALIDA: objeto paginado con results[] de compras (supplier, total, balance, items con la cuenta del gasto). Útil para analizar gastos por proveedor o concepto.',
    inputSchema: { type: 'object', properties: { ...pageProps, ...createdRangeProps } },
    outputSchema: paginated(purchaseSchema),
    annotations: RO,
    handler: (args: any) =>
      run(listPurchasesSchema, args, 'Listing purchases', (p) =>
        client.get(SIIGO_ENDPOINTS.PURCHASES, { params: p })
      ),
  });

  tools.set('siigo_get_purchase', {
    name: 'siigo_get_purchase',
    description:
      'Obtiene una factura de compra/gasto por su ID (GUID). SALIDA: compra completa con supplier, items[] (cuentas del gasto), total, balance.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la compra.' } },
      required: ['id'],
    },
    outputSchema: single(purchaseSchema, 'Factura de compra.'),
    annotations: RO,
    handler: (args: any) =>
      run(idParamSchema, args, 'Getting purchase', ({ id }) => client.get(SIIGO_ENDPOINTS.PURCHASE(id))),
  });

  if (!enableWrite) return;

  tools.set('siigo_create_purchase', {
    name: 'siigo_create_purchase',
    description:
      'Crea una factura de compra (tipo de documento FC) o documento soporte. Recibe el objeto `purchase` con la estructura del blueprint (document.id, supplier, items[], payments[]). Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { purchase: { type: 'object', description: 'Datos de la compra (ver siigoapi.apib).' } },
      required: ['purchase'],
    },
    outputSchema: single(purchaseSchema, 'Compra creada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createPurchaseSchema, args, 'Creating purchase', ({ purchase }) =>
        client.post(SIIGO_ENDPOINTS.PURCHASES, purchase)
      ),
  });

  tools.set('siigo_update_purchase', {
    name: 'siigo_update_purchase',
    description: 'Actualiza una factura de compra existente. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) de la compra.' },
        purchase: { type: 'object', description: 'Datos a actualizar.' },
      },
      required: ['id', 'purchase'],
    },
    outputSchema: single(purchaseSchema, 'Compra actualizada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(updatePurchaseSchema, args, 'Updating purchase', ({ id, purchase }) =>
        client.put(SIIGO_ENDPOINTS.PURCHASE(id), purchase)
      ),
  });

  tools.set('siigo_delete_purchase', {
    name: 'siigo_delete_purchase',
    description: 'Elimina una factura de compra. Operación destructiva. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la compra.' } },
      required: ['id'],
    },
    annotations: DESTRUCTIVE,
    handler: (args: any) =>
      run(idParamSchema, args, 'Deleting purchase', ({ id }) => client.delete(SIIGO_ENDPOINTS.PURCHASE(id))),
  });
}
