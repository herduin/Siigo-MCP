import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listProductsSchema,
  getProductSchema,
  searchProductsSchema,
} from '../schemas/siigo.schemas.js';
import { paginated, single, envelope, productSchema } from '../schemas/output.schemas.js';
import logger from '../utils/logger.js';

export function registerProductTools(tools: Map<string, any>, client: SiigoClient) {
  // List products
  tools.set('siigo_list_products', {
    name: 'siigo_list_products',
    description:
      'Lista productos/servicios del inventario de Siigo (paginado, ordenados por fecha de creación descendente). Filtros: code, created_start/created_end, updated_start/updated_end. SALIDA: objeto paginado con results[] de productos (cada uno con code, name, prices[], taxes[], available_quantity, warehouses[]).',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
        code: { type: 'string', description: 'Filtra por código del producto.' },
        created_start: { type: 'string', description: 'Fecha de creación >= (YYYY-MM-DD).' },
        created_end: { type: 'string', description: 'Fecha de creación <= (YYYY-MM-DD).' },
        updated_start: { type: 'string', description: 'Fecha de actualización >= (YYYY-MM-DD).' },
        updated_end: { type: 'string', description: 'Fecha de actualización <= (YYYY-MM-DD).' },
      },
    },
    outputSchema: paginated(productSchema),
    handler: async (args: any) => {
      const params = validateInput(listProductsSchema, args);
      logger.info({ params }, 'Listing products');

      const result = await client.get(SIIGO_ENDPOINTS.PRODUCTS, { params });
      return { success: true, data: result };
    },
  });

  // Get product by ID
  tools.set('siigo_get_product', {
    name: 'siigo_get_product',
    description:
      'Obtiene un producto/servicio por su ID (GUID). SALIDA: producto completo con code, name, account_group, type, prices[], taxes[], unit, available_quantity, warehouses[] y metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) del producto.' },
      },
      required: ['id'],
    },
    outputSchema: single(productSchema, 'Producto o servicio.'),
    handler: async (args: any) => {
      const { id } = validateInput(getProductSchema, args);
      logger.info({ productId: id }, 'Getting product');

      const result = await client.get(SIIGO_ENDPOINTS.PRODUCT(id));
      return { success: true, data: result };
    },
  });

  // Search products (por código)
  tools.set('siigo_search_products', {
    name: 'siigo_search_products',
    description:
      'Busca productos por código (code) — único filtro de texto soportado por Siigo (no es búsqueda full-text por nombre/descripción). SALIDA: objeto paginado con results[] de productos.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Código del producto a buscar.' },
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
      },
      required: ['code'],
    },
    outputSchema: paginated(productSchema),
    handler: async (args: any) => {
      const params = validateInput(searchProductsSchema, args);
      logger.info({ params }, 'Searching products');

      const result = await client.get(SIIGO_ENDPOINTS.PRODUCTS, { params });
      return { success: true, data: result };
    },
  });

  // Get product stock (derivado del producto)
  tools.set('siigo_get_product_stock', {
    name: 'siigo_get_product_stock',
    description:
      'Obtiene la información de stock/inventario de un producto. SALIDA construida por el MCP: { productId, stockControl, availableQuantity, warehouses[] } derivada del producto en Siigo.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) del producto.' },
      },
      required: ['id'],
    },
    outputSchema: envelope(
      {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'ID del producto consultado.' },
          stockControl: { type: 'boolean', description: 'Indica si el producto maneja control de inventario.' },
          availableQuantity: { type: 'number', description: 'Cantidad disponible total (todas las bodegas).' },
          warehouses: { type: 'array', items: { type: 'object' }, description: 'Bodegas con su cantidad disponible.' },
        },
      },
      'Información de stock derivada del producto.'
    ),
    handler: async (args: any) => {
      const { id } = validateInput(getProductSchema, args);
      logger.info({ productId: id }, 'Getting product stock');

      const product = await client.get(SIIGO_ENDPOINTS.PRODUCT(id));
      return {
        success: true,
        data: {
          productId: id,
          stockControl: (product as any).stock_control,
          availableQuantity: (product as any).available_quantity || 0,
          warehouses: (product as any).warehouses || [],
        },
      };
    },
  });
}
