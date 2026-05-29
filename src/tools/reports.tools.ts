import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  financialSummarySchema,
  salesSummarySchema,
  customerStatementSchema,
  accountsReceivableAgingSchema,
} from '../schemas/siigo.schemas.js';
import logger from '../utils/logger.js';

export function registerReportTools(tools: Map<string, any>, client: SiigoClient) {
  // Financial summary report
  tools.set('siigo_financial_summary', {
    name: 'siigo_financial_summary',
    description:
      'Generate financial summary report with key metrics. Returns total revenue, outstanding receivables, payments received, and credit notes for the specified period. Ideal for AI agents providing executive summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(financialSummarySchema, args);
      logger.info({ params }, 'Generating financial summary');

      // Fetch data from multiple endpoints
      const [invoices, payments, creditNotes] = await Promise.all([
        client.get(SIIGO_ENDPOINTS.INVOICES, {
          params: { startDate: params.startDate, endDate: params.endDate },
        }),
        client.get(SIIGO_ENDPOINTS.PAYMENTS, {
          params: { startDate: params.startDate, endDate: params.endDate },
        }),
        client.get(SIIGO_ENDPOINTS.CREDIT_NOTES, {
          params: { startDate: params.startDate, endDate: params.endDate },
        }),
      ]);

      const invoicesData = (invoices as any).results || [];
      const paymentsData = (payments as any).results || [];
      const creditNotesData = (creditNotes as any).results || [];

      const totalRevenue = invoicesData.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const totalPayments = paymentsData.reduce((sum: number, pay: any) => sum + (pay.total || 0), 0);
      const totalCreditNotes = creditNotesData.reduce((sum: number, cn: any) => sum + (cn.total || 0), 0);
      const totalReceivables = invoicesData.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0);

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
            paymentCount: paymentsData.length,
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
      'Generate sales summary report grouped by period (day, week, or month). Returns revenue trends and invoice counts. Perfect for AI agents doing sales analysis and forecasting.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        groupBy: { type: 'string', enum: ['day', 'week', 'month'], description: 'Grouping period (default: month)' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(salesSummarySchema, args);
      logger.info({ params }, 'Generating sales summary');

      const invoices = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: { startDate: params.startDate, endDate: params.endDate },
      });

      const invoicesData = (invoices as any).results || [];

      // Group invoices by period
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

        if (!grouped[key]) {
          grouped[key] = { total: 0, count: 0 };
        }
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
      'Generate customer account statement showing all transactions (invoices, payments, credit notes) for a specific customer in a date range. Essential for AI agents managing customer relationships.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['customerId'],
    },
    handler: async (args: any) => {
      const params = validateInput(customerStatementSchema, args);
      logger.info({ params }, 'Generating customer statement');

      const [customer, invoices, payments] = await Promise.all([
        client.get(SIIGO_ENDPOINTS.CUSTOMER(params.customerId)),
        client.get(SIIGO_ENDPOINTS.INVOICES, {
          params: {
            customerId: params.customerId,
            startDate: params.startDate,
            endDate: params.endDate,
          },
        }),
        client.get(SIIGO_ENDPOINTS.PAYMENTS, {
          params: {
            customerId: params.customerId,
            startDate: params.startDate,
            endDate: params.endDate,
          },
        }),
      ]);

      const invoicesData = (invoices as any).results || [];
      const paymentsData = (payments as any).results || [];

      const totalInvoiced = invoicesData.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const totalPaid = paymentsData.reduce((sum: number, pay: any) => sum + (pay.total || 0), 0);
      const balance = invoicesData.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0);

      return {
        success: true,
        data: {
          customer,
          period: { startDate: params.startDate, endDate: params.endDate },
          summary: {
            totalInvoiced,
            totalPaid,
            currentBalance: balance,
          },
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
      'Generate monthly revenue report comparing current month to previous months. Returns revenue trends and growth percentages. Useful for AI agents doing performance analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'Number of months to include (default: 12)' },
      },
    },
    handler: async (args: any) => {
      const months = args.months || 12;
      logger.info({ months }, 'Generating monthly revenue report');

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const invoices = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      });

      const invoicesData = (invoices as any).results || [];

      // Group by month
      const monthly: Record<string, number> = {};
      invoicesData.forEach((inv: any) => {
        const date = new Date(inv.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthly[key] = (monthly[key] || 0) + (inv.total || 0);
      });

      const monthlyData = Object.entries(monthly)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        success: true,
        data: {
          months,
          monthlyRevenue: monthlyData,
        },
      };
    },
  });

  // Tax summary report
  tools.set('siigo_tax_summary', {
    name: 'siigo_tax_summary',
    description:
      'Generate tax summary report showing collected taxes by type for a period. Returns tax breakdown by invoice. Essential for AI agents preparing tax reports.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(financialSummarySchema, args);
      logger.info({ params }, 'Generating tax summary');

      const invoices = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: { startDate: params.startDate, endDate: params.endDate },
      });

      const invoicesData = (invoices as any).results || [];

      // Aggregate taxes
      const taxTotals: Record<string, { name: string; total: number; count: number }> = {};

      invoicesData.forEach((inv: any) => {
        if (inv.items) {
          inv.items.forEach((item: any) => {
            if (item.taxes) {
              item.taxes.forEach((tax: any) => {
                const key = `${tax.id}`;
                if (!taxTotals[key]) {
                  taxTotals[key] = { name: tax.name, total: 0, count: 0 };
                }
                taxTotals[key].total += tax.value || 0;
                taxTotals[key].count += 1;
              });
            }
          });
        }
      });

      return {
        success: true,
        data: {
          period: { startDate: params.startDate, endDate: params.endDate },
          taxSummary: Object.entries(taxTotals).map(([id, data]) => ({
            taxId: id,
            ...data,
          })),
        },
      };
    },
  });

  // Accounts receivable aging report
  tools.set('siigo_accounts_receivable_aging', {
    name: 'siigo_accounts_receivable_aging',
    description:
      'Generate accounts receivable aging report showing overdue invoices grouped by age (current, 30 days, 60 days, 90+ days). Critical for AI agents managing collections and credit risk.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Filter by customer ID (optional)' },
        asOfDate: { type: 'string', description: 'As of date (YYYY-MM-DD, default: today)' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(accountsReceivableAgingSchema, args);
      const asOfDate = params.asOfDate ? new Date(params.asOfDate) : new Date();
      logger.info({ params, asOfDate }, 'Generating AR aging report');

      const invoices = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: {
          balance: '>0',
          ...(params.customerId && { customerId: params.customerId }),
        },
      });

      const invoicesData = (invoices as any).results || [];

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
          customerId: params.customerId,
          aging,
          totalOutstanding: Object.values(aging).reduce((sum, bucket) => sum + bucket.total, 0),
        },
      };
    },
  });
}
