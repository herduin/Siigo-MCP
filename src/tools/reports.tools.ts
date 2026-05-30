import axios from 'axios';
import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  financialSummarySchema,
  salesSummarySchema,
  customerStatementSchema,
  accountsReceivableAgingSchema,
  monthlyRevenueReportSchema,
  trialBalanceSchema,
  trialBalanceByThirdSchema,
  accountsPayableSchema,
  profitAndLossSchema,
  expensesByPeriodSchema,
  topProductsSchema,
} from '../schemas/siigo.schemas.js';
import { envelope, genericObject } from '../schemas/output.schemas.js';
import { RO, run } from './_helpers.js';
import { parseXlsxRows, buildProfitAndLoss } from '../utils/xlsx.js';
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

      const invoicesData = await fetchAllPages(
        client,
        SIIGO_ENDPOINTS.INVOICES,
        toCreatedRange(params.startDate, params.endDate)
      );

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

      const [customerSearch, invoicesData, vouchersAll] = await Promise.all([
        client.get(SIIGO_ENDPOINTS.CUSTOMERS, {
          params: { identification: params.customer_identification },
        }),
        fetchAllPages(client, SIIGO_ENDPOINTS.INVOICES, {
          ...range,
          customer_identification: params.customer_identification,
        }),
        fetchAllPages(client, SIIGO_ENDPOINTS.VOUCHERS, range),
      ]);

      const customer = (customerSearch as any).results?.[0] || null;
      // Los recibos de caja no se filtran por cliente en la API; se filtran en memoria.
      const paymentsData = vouchersAll.filter(
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

      const invoicesData = await fetchAllPages(
        client,
        SIIGO_ENDPOINTS.INVOICES,
        toCreatedRange(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
      );

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

      const invoicesData = await fetchAllPages(
        client,
        SIIGO_ENDPOINTS.INVOICES,
        toCreatedRange(params.startDate, params.endDate)
      );

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

      const allInvoices = await fetchAllPages(
        client,
        SIIGO_ENDPOINTS.INVOICES,
        params.customer_identification
          ? { customer_identification: params.customer_identification }
          : {}
      );
      const invoicesData = allInvoices.filter((inv: any) => (inv.balance ?? 0) > 0);

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

  // ═══════════════════════════════════════════════════════════════════════
  // Reportes contables de Siigo
  // ═══════════════════════════════════════════════════════════════════════

  tools.set('siigo_get_trial_balance', {
    name: 'siigo_get_trial_balance',
    description:
      'Genera el balance de prueba general (Excel) para un rango de meses. SALIDA: { file_id, file_url } con la URL del Excel. Para un P&L ya estructurado usa siigo_profit_and_loss.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Año.' },
        month_start: { type: 'number', description: 'Mes inicial (1-13).' },
        month_end: { type: 'number', description: 'Mes final (1-13).' },
        includes_tax_difference: { type: 'boolean', description: 'Incluir diferencias de impuestos.' },
        account_start: { type: 'string', description: 'Cuenta inicial (opcional).' },
        account_end: { type: 'string', description: 'Cuenta final (opcional).' },
      },
      required: ['year', 'month_start', 'month_end'],
    },
    outputSchema: envelope(genericObject, 'Referencia al Excel generado ({ file_id, file_url }).'),
    annotations: RO,
    handler: (args: any) =>
      run(trialBalanceSchema, args, 'Trial balance', (p) => client.post(SIIGO_ENDPOINTS.TRIAL_BALANCE, p)),
  });

  tools.set('siigo_get_trial_balance_by_third', {
    name: 'siigo_get_trial_balance_by_third',
    description:
      'Genera el balance de prueba por tercero (Excel) para un rango de meses, opcionalmente filtrado por cliente. SALIDA: { file_id, file_url }.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Año.' },
        month_start: { type: 'number', description: 'Mes inicial (1-13).' },
        month_end: { type: 'number', description: 'Mes final (1-13).' },
        includes_tax_difference: { type: 'boolean', description: 'Incluir diferencias de impuestos.' },
        account_start: { type: 'string', description: 'Cuenta inicial (opcional).' },
        account_end: { type: 'string', description: 'Cuenta final (opcional).' },
        customer: {
          type: 'object',
          description: 'Filtro por cliente: { identification, branch_office? }.',
        },
      },
      required: ['year', 'month_start', 'month_end'],
    },
    outputSchema: envelope(genericObject, 'Referencia al Excel generado.'),
    annotations: RO,
    handler: (args: any) =>
      run(trialBalanceByThirdSchema, args, 'Trial balance by third', (p) =>
        client.post(SIIGO_ENDPOINTS.TRIAL_BALANCE_BY_THIRD, p)
      ),
  });

  tools.set('siigo_get_accounts_payable', {
    name: 'siigo_get_accounts_payable',
    description:
      'Obtiene el reporte de cuentas por pagar (cartera de proveedores), paginado. SALIDA: objeto paginado con los saldos por proveedor.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
      },
    },
    outputSchema: envelope(genericObject, 'Cuentas por pagar (paginado).'),
    annotations: RO,
    handler: (args: any) =>
      run(accountsPayableSchema, args, 'Accounts payable', (p) =>
        client.get(SIIGO_ENDPOINTS.ACCOUNTS_PAYABLE, { params: p })
      ),
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Reportes de valor agregado del MCP (no existen en la API cruda)
  // ═══════════════════════════════════════════════════════════════════════

  tools.set('siigo_profit_and_loss', {
    name: 'siigo_profit_and_loss',
    description:
      'Estado de Resultados (P&L) ya estructurado para un rango de meses del año. Internamente genera el balance de prueba, descarga el Excel y lo procesa según el PUC (clase 4 ingresos, 5 gastos, 6/7 costos). SALIDA: { company, period, income, costOfSales, productionCost, expenses, netProfit, netMarginPct, incomeByGroup[], expensesByGroup[] }.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Año (ej. 2026).' },
        month_start: { type: 'number', description: 'Mes inicial (1-12, default 1).' },
        month_end: { type: 'number', description: 'Mes final (1-12).' },
      },
      required: ['year', 'month_end'],
    },
    outputSchema: envelope(genericObject, 'Estado de resultados estructurado.'),
    annotations: RO,
    handler: (args: any) =>
      run(profitAndLossSchema, args, 'Profit and loss', async (p) => {
        const report: any = await client.post(SIIGO_ENDPOINTS.TRIAL_BALANCE, {
          year: p.year,
          month_start: p.month_start,
          month_end: p.month_end,
          includes_tax_difference: false,
        });
        const url = report?.file_url;
        if (!url) throw new Error('Siigo no devolvió file_url para el balance de prueba');
        const xlsx = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
        const rows = parseXlsxRows(new Uint8Array(xlsx.data));
        return buildProfitAndLoss(rows);
      }),
  });

  tools.set('siigo_expenses_by_period', {
    name: 'siigo_expenses_by_period',
    description:
      'Resumen de gastos (facturas de compra) en un rango de fechas, agregado por proveedor y por concepto/cuenta. SALIDA: { period, total, count, byProvider[], byConcept[] }.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD).' },
      },
      required: ['startDate', 'endDate'],
    },
    outputSchema: envelope(genericObject, 'Gastos agregados por proveedor y concepto.'),
    annotations: RO,
    handler: (args: any) =>
      run(expensesByPeriodSchema, args, 'Expenses by period', async (p) => {
        const rows = await fetchAllPages(client, SIIGO_ENDPOINTS.PURCHASES, {
          created_start: p.startDate,
          created_end: p.endDate,
        });
        const byProvider: Record<string, { total: number; count: number }> = {};
        const byConcept: Record<string, number> = {};
        let total = 0;
        for (const pu of rows) {
          total += pu.total || 0;
          const nit = pu.supplier?.identification || '?';
          byProvider[nit] = byProvider[nit] || { total: 0, count: 0 };
          byProvider[nit].total += pu.total || 0;
          byProvider[nit].count += 1;
          for (const it of pu.items || []) {
            const key = `${it.code || ''}|${(it.description || '').split('\n')[0]}`;
            byConcept[key] = (byConcept[key] || 0) + (it.total || 0);
          }
        }
        return {
          period: { startDate: p.startDate, endDate: p.endDate },
          total,
          count: rows.length,
          byProvider: Object.entries(byProvider)
            .map(([identification, v]) => ({ identification, ...v }))
            .sort((a, b) => b.total - a.total),
          byConcept: Object.entries(byConcept)
            .map(([k, value]) => ({ code: k.split('|')[0], concept: k.split('|')[1], value }))
            .sort((a, b) => b.value - a.value),
        };
      }),
  });

  tools.set('siigo_top_products', {
    name: 'siigo_top_products',
    description:
      'Ranking de productos más vendidos en un rango de fechas (a partir de los ítems de las facturas de venta). Parámetros: startDate, endDate, limit (default 10), by ("value" o "quantity"). SALIDA: { period, by, products[] } con quantity, total y count por producto.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD).' },
        limit: { type: 'number', description: 'Cantidad de productos en el ranking (default 10).' },
        by: { type: 'string', enum: ['value', 'quantity'], description: 'Criterio de orden (default value).' },
      },
      required: ['startDate', 'endDate'],
    },
    outputSchema: envelope(genericObject, 'Ranking de productos vendidos.'),
    annotations: RO,
    handler: (args: any) =>
      run(topProductsSchema, args, 'Top products', async (p) => {
        const rows = await fetchAllPages(client, SIIGO_ENDPOINTS.INVOICES, {
          created_start: p.startDate,
          created_end: p.endDate,
        });
        const prod: Record<string, { code: string; description: string; quantity: number; total: number; count: number }> = {};
        for (const inv of rows) {
          for (const it of inv.items || []) {
            const key = it.code || it.id || it.description || 'N/A';
            prod[key] = prod[key] || { code: it.code || '', description: it.description || '', quantity: 0, total: 0, count: 0 };
            prod[key].quantity += it.quantity || 0;
            prod[key].total += it.total || 0;
            prod[key].count += 1;
          }
        }
        const sorted = Object.values(prod).sort((a, b) =>
          p.by === 'quantity' ? b.quantity - a.quantity : b.total - a.total
        );
        return { period: { startDate: p.startDate, endDate: p.endDate }, by: p.by, products: sorted.slice(0, p.limit) };
      }),
  });
}

/**
 * Recorre todas las páginas de un listado de Siigo y devuelve `results` concatenados.
 * Cap de seguridad de 50 páginas.
 */
async function fetchAllPages(
  client: SiigoClient,
  endpoint: string,
  params: Record<string, unknown>
): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const all: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let page = 1;
  for (; page <= 50; page++) {
    const res: any = await client.get(endpoint, { params: { ...params, page, page_size: 100 } });
    const results = res?.results || [];
    all.push(...results);
    const total = res?.pagination?.total_results ?? all.length;
    if (all.length >= total || results.length === 0) break;
  }
  return all;
}
