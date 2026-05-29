import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  financialSummarySchema,
  salesSummarySchema,
  customerStatementSchema,
  accountsReceivableAgingSchema,
  monthlyRevenueReportSchema,
} from '../schemas/siigo.schemas.js';
import { envelope } from '../schemas/output.schemas.js';
import logger from '../utils/logger.js';

/**
 * Traduce un rango startDate/endDate (parámetros de conveniencia del MCP) a los
 * query params reales de Siigo (created_start/created_end). Omite los ausentes.
 */
function toCreatedRange(startDate?: string, endDate?: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (startDate) params.created_start = startDate;
  if (endDate) params.created_end = endDate;
  return params;
}

export function registerReportTools(tools: Map<string, any>, client: SiigoClient) {
  // Financial summary report
  tools.set('siigo_financial_summary', {
    name: 'siigo_financial_summary',
    description:
      'Reporte de resumen financiero del periodo (agregado por el MCP a partir de facturas, recibos de caja y notas crédito). Parámetros startDate/endDate (YYYY-MM-DD) que el MCP traduce a created_start/created_end de Siigo. SALIDA: { period, summary: { totalRevenue, totalPayments, totalCreditNotes, totalReceivables, netRevenue, invoiceCount, paymentCount, creditNoteCount } }.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Fecha inicio del periodo (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Fecha fin del periodo (YYYY-MM-DD).' },
      },
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        period: { type: 'object', description: 'Periodo consultado.' },
        summary: {
          type: 'object',
          properties: {
            totalRevenue: { type: 'number', description: 'Suma de totales de facturas.' },
            totalPayments: { type: 'number', description: 'Suma de recibos de caja (pagos recibidos).' },
            totalCreditNotes: { type: 'number', description: 'Suma de notas crédito.' },
            totalReceivables: { type: 'number', description: 'Suma de saldos pendientes (balance) de facturas.' },
            netRevenue: { type: 'number', description: 'totalRevenue - totalCreditNotes.' },
            invoiceCount: { type: 'number' },
            paymentCount: { type: 'number' },
            creditNoteCount: { type: 'number' },
          },
        },
      },
    }),
    handler: async (args: any) => {
      const params = validateInput(financialSummarySchema, args);
      logger.info({ params }, 'Generating financial summary');
      const range = toCreatedRange(params.startDate, params.endDate);

      const [invoices, vouchers, creditNotes] = await Promise.all([
        client.get(SIIGO_ENDPOINTS.INVOICES, { params: range }),
        client.get(SIIGO_ENDPOINTS.VOUCHERS, { params: range }),
        client.get(SIIGO_ENDPOINTS.CREDIT_NOTES, { params: range }),
      ]);

      const invoicesData = (invoices as any).results || [];
      const vouchersData = (vouchers as any).results || [];
      const creditNotesData = (creditNotes as any).results || [];

      const totalRevenue = invoicesData.reduce((s: number, inv: any) => s + (inv.total || 0), 0);
      const totalPayments = vouchersData.reduce(
        (s: number, v: any) => s + (v.payment?.value || 0),
        0
      );
      const totalCreditNotes = creditNotesData.reduce((s: number, cn: any) => s + (cn.total || 0), 0);
      const totalReceivables = invoicesData.reduce((s: number, inv: any) => s + (inv.balance || 0), 0);

      return {
        success: true,
        data: {
          period: { startDate: params.startDate, endDate: params.endDate },
          summary: {
            totalRevenue,
            totalPayments,
            totalCreditNotes,
            totalReceivables,
            netRevenue: totalRevenue - totalCreditNotes,
            invoiceCount: invoicesData.length,
            paymentCount: vouchersData.length,
            creditNoteCount: creditNotesData.length,
          },
        },
      };
    },
  });

  // Sales summary report
  tools.set('siigo_sales_summary', {
    name: 'siigo_sales_summary',
    description:
      'Reporte de ventas agrupado por periodo (day/week/month). Parámetros startDate/endDate (traducidos a created_start/created_end) y groupBy. SALIDA: { period, groupBy, salesByPeriod: [{ period, total, count }] }.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD).' },
        groupBy: { type: 'string', enum: ['day', 'week', 'month'], description: 'Agrupación (default: month).' },
      },
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        period: { type: 'object' },
        groupBy: { type: 'string' },
        salesByPeriod: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              period: { type: 'string' },
              total: { type: 'number' },
              count: { type: 'number' },
            },
          },
        },
      },
    }),
    handler: async (args: any) => {
      const params = validateInput(salesSummarySchema, args);
      logger.info({ params }, 'Generating sales summary');

      const invoices = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: toCreatedRange(params.startDate, params.endDate),
      });
      const invoicesData = (invoices as any).results || [];

      const grouped: Record<string, { total: number; count: number }> = {};
      invoicesData.forEach((inv: any) => {
        const date = new Date(inv.date);
        let key: string;
        if (params.groupBy === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (params.groupBy === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
        grouped[key].total += inv.total || 0;
        grouped[key].count += 1;
      });

      return {
        success: true,
        data: {
          period: { startDate: params.startDate, endDate: params.endDate },
          groupBy: params.groupBy,
          salesByPeriod: Object.entries(grouped)
            .map(([period, data]) => ({ period, ...data }))
            .sort((a, b) => a.period.localeCompare(b.period)),
        },
      };
    },
  });

  // Customer statement report
  tools.set('siigo_customer_statement', {
    name: 'siigo_customer_statement',
    description:
      'Estado de cuenta de un cliente (por número de identificación) en un rango: facturas y recibos de caja. SALIDA: { customer, period, summary: { totalInvoiced, totalPaid, currentBalance }, invoices, payments }.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_identification: { type: 'string', description: 'Número de identificación del cliente.' },
        startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD).' },
      },
      required: ['customer_identification'],
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        customer: { type: 'object', description: 'Datos del cliente (si se encuentra por identificación).' },
        period: { type: 'object' },
        summary: {
          type: 'object',
          properties: {
            totalInvoiced: { type: 'number' },
            totalPaid: { type: 'number' },
            currentBalance: { type: 'number' },
          },
        },
        invoices: { type: 'array', items: { type: 'object' } },
        payments: { type: 'array', items: { type: 'object' }, description: 'Recibos de caja del cliente.' },
      },
    }),
    handler: async (args: any) => {
      const params = validateInput(customerStatementSchema, args);
      logger.info({ params }, 'Generating customer statement');
      const range = toCreatedRange(params.startDate, params.endDate);

      const [customerSearch, invoices, vouchers] = await Promise.all([
        client.get(SIIGO_ENDPOINTS.CUSTOMERS, {
          params: { identification: params.customer_identification },
        }),
        client.get(SIIGO_ENDPOINTS.INVOICES, {
          params: { ...range, customer_identification: params.customer_identification },
        }),
        client.get(SIIGO_ENDPOINTS.VOUCHERS, { params: range }),
      ]);

      const customer = (customerSearch as any).results?.[0] || null;
      const invoicesData = (invoices as any).results || [];
      // Los recibos de caja no se filtran por cliente en la API; se filtran en memoria.
      const paymentsData = ((vouchers as any).results || []).filter(
        (v: any) => v.customer?.identification === params.customer_identification
      );

      const totalInvoiced = invoicesData.reduce((s: number, inv: any) => s + (inv.total || 0), 0);
      const totalPaid = paymentsData.reduce((s: number, v: any) => s + (v.payment?.value || 0), 0);
      const currentBalance = invoicesData.reduce((s: number, inv: any) => s + (inv.balance || 0), 0);

      return {
        success: true,
        data: {
          customer,
          period: { startDate: params.startDate, endDate: params.endDate },
          summary: { totalInvoiced, totalPaid, currentBalance },
          invoices: invoicesData,
          payments: paymentsData,
        },
      };
    },
  });

  // Monthly revenue report
  tools.set('siigo_monthly_revenue_report', {
    name: 'siigo_monthly_revenue_report',
    description:
      'Reporte de ingresos por mes en los últimos N meses (default 12). SALIDA: { months, monthlyRevenue: [{ month, revenue }] }.',
    inputSchema: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'Cantidad de meses a incluir (default: 12, máx: 36).' },
      },
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        months: { type: 'number' },
        monthlyRevenue: {
          type: 'array',
          items: {
            type: 'object',
            properties: { month: { type: 'string' }, revenue: { type: 'number' } },
          },
        },
      },
    }),
    handler: async (args: any) => {
      const months = validateInput(monthlyRevenueReportSchema, args).months ?? 12;
      logger.info({ months }, 'Generating monthly revenue report');

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const invoices = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: toCreatedRange(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        ),
      });
      const invoicesData = (invoices as any).results || [];

      const monthly: Record<string, number> = {};
      invoicesData.forEach((inv: any) => {
        const date = new Date(inv.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthly[key] = (monthly[key] || 0) + (inv.total || 0);
      });

      return {
        success: true,
        data: {
          months,
          monthlyRevenue: Object.entries(monthly)
            .map(([month, revenue]) => ({ month, revenue }))
            .sort((a, b) => a.month.localeCompare(b.month)),
        },
      };
    },
  });

  // Tax summary report
  tools.set('siigo_tax_summary', {
    name: 'siigo_tax_summary',
    description:
      'Resumen de impuestos recaudados por tipo en un periodo (agregado de los impuestos de los ítems de las facturas). Parámetros startDate/endDate. SALIDA: { period, taxSummary: [{ taxId, name, total, count }] }.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD).' },
      },
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        period: { type: 'object' },
        taxSummary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              taxId: { type: 'string' },
              name: { type: 'string' },
              total: { type: 'number' },
              count: { type: 'number' },
            },
          },
        },
      },
    }),
    handler: async (args: any) => {
      const params = validateInput(financialSummarySchema, args);
      logger.info({ params }, 'Generating tax summary');

      const invoices = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: toCreatedRange(params.startDate, params.endDate),
      });
      const invoicesData = (invoices as any).results || [];

      const taxTotals: Record<string, { name: string; total: number; count: number }> = {};
      invoicesData.forEach((inv: any) => {
        (inv.items || []).forEach((item: any) => {
          (item.taxes || []).forEach((tax: any) => {
            const key = `${tax.id}`;
            if (!taxTotals[key]) taxTotals[key] = { name: tax.name, total: 0, count: 0 };
            taxTotals[key].total += tax.value || 0;
            taxTotals[key].count += 1;
          });
        });
      });

      return {
        success: true,
        data: {
          period: { startDate: params.startDate, endDate: params.endDate },
          taxSummary: Object.entries(taxTotals).map(([id, data]) => ({ taxId: id, ...data })),
        },
      };
    },
  });

  // Accounts receivable aging report
  tools.set('siigo_accounts_receivable_aging', {
    name: 'siigo_accounts_receivable_aging',
    description:
      'Reporte de cartera por edades: facturas con saldo (balance > 0) agrupadas por antigüedad (current, 30, 60, 90, 90+ días) respecto a asOfDate. Filtro opcional customer_identification. El MCP obtiene facturas y filtra por balance>0 en memoria. SALIDA: { asOfDate, customer_identification?, aging: { current, days30, days60, days90, days90Plus }, totalOutstanding }.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_identification: { type: 'string', description: 'Identificación del cliente (opcional).' },
        asOfDate: { type: 'string', description: 'Fecha de corte (YYYY-MM-DD, default: hoy).' },
      },
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        asOfDate: { type: 'string' },
        customer_identification: { type: 'string' },
        aging: { type: 'object', description: 'Buckets de antigüedad con total, count e invoices[].' },
        totalOutstanding: { type: 'number', description: 'Saldo total pendiente.' },
      },
    }),
    handler: async (args: any) => {
      const params = validateInput(accountsReceivableAgingSchema, args);
      const asOfDate = params.asOfDate ? new Date(params.asOfDate) : new Date();
      logger.info({ params }, 'Generating AR aging report');

      const invoices: any = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: params.customer_identification
          ? { customer_identification: params.customer_identification }
          : {},
      });
      const invoicesData = (invoices.results || []).filter((inv: any) => (inv.balance ?? 0) > 0);

      const aging = {
        current: { total: 0, count: 0, invoices: [] as any[] },
        days30: { total: 0, count: 0, invoices: [] as any[] },
        days60: { total: 0, count: 0, invoices: [] as any[] },
        days90: { total: 0, count: 0, invoices: [] as any[] },
        days90Plus: { total: 0, count: 0, invoices: [] as any[] },
      };

      invoicesData.forEach((inv: any) => {
        const dueDate = new Date(inv.date);
        const daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        let bucket: keyof typeof aging;
        if (daysOverdue < 0) bucket = 'current';
        else if (daysOverdue < 30) bucket = 'days30';
        else if (daysOverdue < 60) bucket = 'days60';
        else if (daysOverdue < 90) bucket = 'days90';
        else bucket = 'days90Plus';

        aging[bucket].total += inv.balance || 0;
        aging[bucket].count += 1;
        aging[bucket].invoices.push({
          id: inv.id,
          number: inv.number,
          date: inv.date,
          balance: inv.balance,
          daysOverdue: Math.max(0, daysOverdue),
        });
      });

      return {
        success: true,
        data: {
          asOfDate: asOfDate.toISOString().split('T')[0],
          customer_identification: params.customer_identification,
          aging,
          totalOutstanding: Object.values(aging).reduce((s, b) => s + b.total, 0),
        },
      };
    },
  });
}
