import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listCustomersSchema,
  searchCustomersSchema,
  getCustomerSchema,
  createCustomerSchema,
  updateCustomerSchema,
  idParamSchema,
} from '../schemas/siigo.schemas.js';
import { paginated, single, customerSchema } from '../schemas/output.schemas.js';
import { WRITE, DESTRUCTIVE, run } from './_helpers.js';
import logger from '../utils/logger.js';

export function registerCustomerTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  // List customers
  tools.set('siigo_list_customers', {
    name: 'siigo_list_customers',
    description:
      'Lista clientes/terceros de Siigo (paginado). Filtros: identification (identificación), branch_office (sucursal), created_start/created_end (creación), updated_start/updated_end (modificación). SALIDA: objeto paginado con results[] de clientes (identification, name[], person_type, address, phones[], fiscal_responsibilities[]).',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
        identification: { type: 'string', description: 'Filtra por número de identificación.' },
        branch_office: { type: 'number', description: 'Filtra por sucursal.' },
        created_start: { type: 'string', description: 'Fecha de creación >= (YYYY-MM-DD).' },
        created_end: { type: 'string', description: 'Fecha de creación <= (YYYY-MM-DD).' },
        updated_start: { type: 'string', description: 'Fecha de modificación >= (YYYY-MM-DD).' },
        updated_end: { type: 'string', description: 'Fecha de modificación <= (YYYY-MM-DD).' },
      },
    },
    outputSchema: paginated(customerSchema),
    handler: async (args: any) => {
      const params = validateInput(listCustomersSchema, args);
      logger.info({ params }, 'Listing customers');

      const result = await client.get(SIIGO_ENDPOINTS.CUSTOMERS, { params });
      return { success: true, data: result };
    },
  });

  // Get customer by ID
  tools.set('siigo_get_customer', {
    name: 'siigo_get_customer',
    description:
      'Obtiene un cliente por su ID (GUID). SALIDA: cliente completo con identification, person_type, id_type, name[], address, phones[], contacts[], fiscal_responsibilities[], related_users y metadata.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del cliente.' } },
      required: ['id'],
    },
    outputSchema: single(customerSchema, 'Cliente / tercero.'),
    handler: async (args: any) => {
      const { id } = validateInput(getCustomerSchema, args);
      logger.info({ customerId: id }, 'Getting customer');

      const result = await client.get(SIIGO_ENDPOINTS.CUSTOMER(id));
      return { success: true, data: result };
    },
  });

  // Search customers (por identificación — único filtro de texto soportado)
  tools.set('siigo_search_customers', {
    name: 'siigo_search_customers',
    description:
      'Busca clientes por su número de identificación (identification). Siigo NO ofrece búsqueda full-text por nombre o email en este endpoint. SALIDA: objeto paginado con results[] de clientes que coinciden con la identificación.',
    inputSchema: {
      type: 'object',
      properties: {
        identification: { type: 'string', description: 'Número de identificación del cliente a buscar.' },
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
      },
      required: ['identification'],
    },
    outputSchema: paginated(customerSchema),
    handler: async (args: any) => {
      const params = validateInput(searchCustomersSchema, args);
      logger.info({ params }, 'Searching customers');

      const result = await client.get(SIIGO_ENDPOINTS.CUSTOMERS, { params });
      return { success: true, data: result };
    },
  });

  if (!enableWrite) return;

  // Create customer
  tools.set('siigo_create_customer', {
    name: 'siigo_create_customer',
    description:
      'Crea un cliente/tercero en Siigo. Recibe el objeto `customer` con la estructura del API (person_type, id_type, identification, name[], address, phones[], etc.). Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { customer: { type: 'object', description: 'Datos del cliente (ver siigoapi.apib).' } },
      required: ['customer'],
    },
    outputSchema: single(customerSchema, 'Cliente creado.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createCustomerSchema, args, 'Creating customer', ({ customer }) =>
        client.post(SIIGO_ENDPOINTS.CUSTOMERS, customer)
      ),
  });

  // Update customer
  tools.set('siigo_update_customer', {
    name: 'siigo_update_customer',
    description: 'Actualiza un cliente/tercero existente por su ID. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) del cliente.' },
        customer: { type: 'object', description: 'Datos a actualizar.' },
      },
      required: ['id', 'customer'],
    },
    outputSchema: single(customerSchema, 'Cliente actualizado.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(updateCustomerSchema, args, 'Updating customer', ({ id, customer }) =>
        client.put(SIIGO_ENDPOINTS.CUSTOMER(id), customer)
      ),
  });

  // Delete customer
  tools.set('siigo_delete_customer', {
    name: 'siigo_delete_customer',
    description: 'Elimina un cliente/tercero. Operación destructiva. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del cliente.' } },
      required: ['id'],
    },
    annotations: DESTRUCTIVE,
    handler: (args: any) =>
      run(idParamSchema, args, 'Deleting customer', ({ id }) => client.delete(SIIGO_ENDPOINTS.CUSTOMER(id))),
  });
}
