import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { arrayOf, userSchema } from '../schemas/output.schemas.js';
import logger from '../utils/logger.js';

export function registerUserTools(tools: Map<string, any>, client: SiigoClient) {
  // List users
  tools.set('siigo_list_users', {
    name: 'siigo_list_users',
    description:
      'Lista los usuarios de la cuenta de Siigo. Sin parámetros. SALIDA: data es un array de usuarios (id, username, first_name, last_name, email, identification, active). Estos usuarios también funcionan como vendedores (seller) al crear documentos.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: arrayOf(userSchema, 'Lista de usuarios.'),
    handler: async () => {
      logger.info('Listing users');
      const result = await client.get(SIIGO_ENDPOINTS.USERS);
      return { success: true, data: result };
    },
  });
}
