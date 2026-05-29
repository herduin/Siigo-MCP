import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listProductsSchema,
  getProductSchema,
  searchProductsSchema,
} from '../schemas/siigo.schemas.js';
import logger from '../utils/logger.js';

export function registerProductTools(tools: Map<string, any>, client: SiigoClient) {
  // List products
  tools.set('siigo_list_products', {
    name: 'siigo_list_products',
    description:
      'List products from Siigo inventory. Returns paginated products with prices, taxes, stock control settings, and availability. Useful for AI agents to browse product catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        active: { type: 'boolean', description: 'Filter by active status' },
        type: { type: 'string', description: 'Product type filter' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(listProductsSchema, args);
      logger.info({ params }, 'Listing products');

      const result = await client.get(SIIGO_ENDPOINTS.PRODUCTS, { params });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get product by ID
  tools.set('siigo_get_product', {
    name: 'siigo_get_product',
    description:
      'Get detailed information about a specific product by ID. Returns complete product details including pricing, taxes, stock levels, and additional fields.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getProductSchema, args);
      logger.info({ productId: id }, 'Getting product');

      const result = await client.get(SIIGO_ENDPOINTS.PRODUCT(id));
      return {
        success: true,
        data: result,
      };
    },
  });

  // Search products
  tools.set('siigo_search_products', {
    name: 'siigo_search_products',
    description:
      'Search products by code, name, or description. Returns matching products with pagination. Ideal for AI agents to find products based on partial information.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (code, name, or description)' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
      },
      required: ['query'],
    },
    handler: async (args: any) => {
      const params = validateInput(searchProductsSchema, args);
      logger.info({ query: params.query }, 'Searching products');

      const result = await client.get(SIIGO_ENDPOINTS.PRODUCTS, {
        params: { ...params, search: params.query },
      });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get product stock
  tools.set('siigo_get_product_stock', {
    name: 'siigo_get_product_stock',
    description:
      'Get current stock/inventory information for a specific product. Returns available quantity and warehouse details if stock control is enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
      required: ['id'],
    },
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
        },
      };
    },
  });
}
