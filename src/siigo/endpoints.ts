export const SIIGO_ENDPOINTS = {
  // Authentication
  AUTH: '/auth',

  // Customers
  CUSTOMERS: '/v1/customers',
  CUSTOMER: (id: string) => `/v1/customers/${id}`,

  // Invoices
  INVOICES: '/v1/invoices',
  INVOICE: (id: string) => `/v1/invoices/${id}`,
  INVOICE_PDF: (id: string) => `/v1/invoices/${id}/pdf`,
  INVOICE_XML: (id: string) => `/v1/invoices/${id}/xml`,
  INVOICE_STAMP_ERRORS: (id: string) => `/v1/invoices/${id}/stamp/errors`,

  // Products
  PRODUCTS: '/v1/products',
  PRODUCT: (id: string) => `/v1/products/${id}`,

  // Taxes
  TAXES: '/v1/taxes',

  // Document Types
  DOCUMENT_TYPES: '/v1/document-types',

  // Payment Methods / Types
  PAYMENT_TYPES: '/v1/payment-types',

  // Cost Centers
  COST_CENTERS: '/v1/cost-centers',

  // Users (los vendedores son usuarios; Siigo no expone un endpoint de "sellers")
  USERS: '/v1/users',
  USER: (id: string) => `/v1/users/${id}`,

  // Vouchers — Recibos de caja (pagos recibidos)
  VOUCHERS: '/v1/vouchers',
  VOUCHER: (id: string) => `/v1/vouchers/${id}`,

  // Payment receipts — Recibos de pago/egreso
  PAYMENT_RECEIPTS: '/v1/payment-receipts',
  PAYMENT_RECEIPT: (id: string) => `/v1/payment-receipts/${id}`,

  // Credit Notes
  CREDIT_NOTES: '/v1/credit-notes',
  CREDIT_NOTE: (id: string) => `/v1/credit-notes/${id}`,
  CREDIT_NOTE_PDF: (id: string) => `/v1/credit-notes/${id}/pdf`,

  // Journal Entries — Comprobantes contables
  JOURNALS: '/v1/journals',
  JOURNAL: (id: string) => `/v1/journals/${id}`,

  // Account Groups — Categorías de inventario
  ACCOUNT_GROUPS: '/v1/account-groups',

  // Warehouses
  WAREHOUSES: '/v1/warehouses',
} as const;
