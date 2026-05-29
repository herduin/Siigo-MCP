import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import { listDocumentTypesSchema, listPaymentTypesSchema } from '../schemas/siigo.schemas.js';
import {
  arrayOf,
  taxSchema,
  documentTypeSchema,
  paymentTypeSchema,
  costCenterSchema,
  userSchema,
} from '../schemas/output.schemas.js';
import logger from '../utils/logger.js';

export function registerTaxTools(tools: Map<string, any>, client: SiigoClient) {
  // List taxes
  tools.set('siigo_list_taxes', {
    name: 'siigo_list_taxes',
    description:
      'Lista los tipos de impuesto configurados en Siigo. Sin parámetros. SALIDA: data es un array de impuestos (id, name, type, percentage, active). El id se usa al crear documentos.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: arrayOf(taxSchema, 'Lista de impuestos.'),
    handler: async () => {
      logger.info('Listing taxes');
      const result = await client.get(SIIGO_ENDPOINTS.TAXES);
      return { success: true, data: result };
    },
  });

  // List document types (requiere type)
  tools.set('siigo_list_document_types', {
    name: 'siigo_list_document_types',
    description:
      'Lista los tipos de comprobante configurados en Siigo para un tipo de documento. REQUIERE el parámetro type. SALIDA: data es un array de tipos de documento (id, code, name, type, consecutive, automatic_number, etc.). El id es necesario para crear documentos.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['FV', 'NC', 'FC', 'DS', 'RC', 'RP', 'CC', 'C'],
          description:
            'Tipo de documento: FV=Factura venta, NC=Nota crédito, FC=Factura compra, DS=Documento soporte, RC=Recibo de caja, RP=Recibo de pago/egreso, CC=Comprobante contable, C=Cotización.',
        },
      },
      required: ['type'],
    },
    outputSchema: arrayOf(documentTypeSchema, 'Lista de tipos de documento del tipo solicitado.'),
    handler: async (args: any) => {
      const params = validateInput(listDocumentTypesSchema, args);
      logger.info({ params }, 'Listing document types');
      const result = await client.get(SIIGO_ENDPOINTS.DOCUMENT_TYPES, { params });
      return { success: true, data: result };
    },
  });

  // List payment methods/types (requiere document_type)
  tools.set('siigo_list_payment_methods', {
    name: 'siigo_list_payment_methods',
    description:
      'Lista las formas/medios de pago configurados en Siigo para un tipo de documento. REQUIERE document_type. SALIDA: data es un array de formas de pago (id, name, type, active, due_date). El id se usa en payments al crear documentos.',
    inputSchema: {
      type: 'object',
      properties: {
        document_type: {
          type: 'string',
          enum: ['FV', 'NC', 'FC', 'DS', 'RC', 'RP', 'CC', 'C'],
          description: 'Tipo de documento para el que se consultan las formas de pago (ej. FV).',
        },
      },
      required: ['document_type'],
    },
    outputSchema: arrayOf(paymentTypeSchema, 'Lista de formas de pago.'),
    handler: async (args: any) => {
      const params = validateInput(listPaymentTypesSchema, args);
      logger.info({ params }, 'Listing payment methods');
      const result = await client.get(SIIGO_ENDPOINTS.PAYMENT_TYPES, { params });
      return { success: true, data: result };
    },
  });

  // List cost centers
  tools.set('siigo_list_cost_centers', {
    name: 'siigo_list_cost_centers',
    description:
      'Lista los centros de costo configurados en Siigo. Sin parámetros. SALIDA: data es un array de centros de costo (id, code, name, active).',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: arrayOf(costCenterSchema, 'Lista de centros de costo.'),
    handler: async () => {
      logger.info('Listing cost centers');
      const result = await client.get(SIIGO_ENDPOINTS.COST_CENTERS);
      return { success: true, data: result };
    },
  });

  // List sellers (en Siigo los vendedores son usuarios)
  tools.set('siigo_list_sellers', {
    name: 'siigo_list_sellers',
    description:
      'Lista los vendedores de Siigo. En Siigo los vendedores son usuarios, por lo que consulta /v1/users. Sin parámetros. SALIDA: data es un array de usuarios (id, username, first_name, last_name, email, identification, active); el id se usa como seller al crear documentos.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: arrayOf(userSchema, 'Lista de usuarios/vendedores.'),
    handler: async () => {
      logger.info('Listing sellers');
      const result = await client.get(SIIGO_ENDPOINTS.USERS);
      return { success: true, data: result };
    },
  });
}
