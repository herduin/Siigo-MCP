import logger from '../utils/logger.js';

interface ToolDef {
  name: string;
  description: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
}

/**
 * Asigna cada tool a un grupo de dominio para el catálogo agéntico.
 * Se basa en el nombre de la tool (convención siigo_<acción>_<dominio>).
 */
function groupForTool(name: string): string {
  if (name === 'siigo_list_tools') return 'Meta';
  if (
    name.includes('summary') ||
    name.includes('statement') ||
    name.includes('aging') ||
    name.includes('revenue')
  )
    return 'Reportes';
  if (name.includes('receivable')) return 'Cartera (cuentas por cobrar)';
  if (name.includes('customer')) return 'Clientes';
  if (name.includes('invoice')) return 'Facturas de venta';
  if (name.includes('product')) return 'Productos / Inventario';
  if (name.includes('credit_note')) return 'Notas crédito';
  if (name.includes('voucher')) return 'Recibos de caja (cobros)';
  if (name.includes('payment_receipt')) return 'Recibos de pago/egreso';
  if (name.includes('journal')) return 'Comprobantes contables';
  if (
    name.includes('tax') ||
    name.includes('document_types') ||
    name.includes('payment_methods') ||
    name.includes('cost_centers') ||
    name.includes('sellers') ||
    name.includes('users')
  )
    return 'Catálogos';
  if (name.includes('health') || name.includes('token') || name.includes('raw')) return 'Sistema / Diagnóstico';
  return 'Otros';
}

/** Primera oración de la descripción, como resumen corto. */
function summarize(description: string): string {
  const firstSentence = description.split('. ')[0];
  return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
}

export function registerMetaTools(tools: Map<string, any>) {
  tools.set('siigo_list_tools', {
    name: 'siigo_list_tools',
    description:
      'Catálogo agéntico de TODAS las herramientas disponibles en este servidor MCP de Siigo. Llámala PRIMERO al conectarte para descubrir qué puedes hacer. Sin parámetros. SALIDA: { success, data: { total, groups: { <grupo>: [{ name, summary, requiredInputs }] }, hint } }. Para los contratos completos (entradas y salidas) de una tool, usa el inputSchema/outputSchema que el cliente MCP ya expone vía tools/list.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            total: { type: 'number', description: 'Número total de herramientas.' },
            groups: {
              type: 'object',
              description: 'Herramientas agrupadas por dominio. Cada entrada es un array de { name, summary, requiredInputs }.',
            },
            hint: { type: 'string', description: 'Sugerencia de uso para el agente.' },
          },
        },
      },
      required: ['success', 'data'],
    },
    handler: async () => {
      logger.info('Listing tool catalog (siigo_list_tools)');

      const groups: Record<string, Array<{ name: string; summary: string; requiredInputs: string[] }>> = {};

      for (const tool of tools.values() as IterableIterator<ToolDef>) {
        if (tool.name === 'siigo_list_tools') continue;
        const group = groupForTool(tool.name);
        if (!groups[group]) groups[group] = [];
        groups[group].push({
          name: tool.name,
          summary: summarize(tool.description),
          requiredInputs: tool.inputSchema?.required ?? [],
        });
      }

      // total = todas las tools menos la propia siigo_list_tools
      const total = tools.size - 1;

      return {
        success: true,
        data: {
          total,
          groups,
          hint: 'Elige la herramienta por su grupo y resumen; revisa su inputSchema/outputSchema (vía tools/list) para los contratos exactos de entrada y salida. Las fechas usan formato YYYY-MM-DD y la paginación usa page / page_size.',
        },
      };
    },
  });
}
