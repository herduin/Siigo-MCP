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
  INVOICE_XML: (id: string) => `/v1/invoices/${id}/stamp`,

  // Products
  PRODUCTS: '/v1/products',
  PRODUCT: (id: string) => `/v1/products/${id}`,

  // Taxes
  TAXES: '/v1/taxes',

  // Document Types
  DOCUMENT_TYPES: '/v1/document-types',

  // Payment Methods
  PAYMENT_TYPES: '/v1/payment-types',

  // Cost Centers
  COST_CENTERS: '/v1/cost-centers',

  // Users
  USERS: '/v1/users',
  USER: (id: string) => `/v1/users/${id}`,

  // Payments
  PAYMENTS: '/v1/payments',
  PAYMENT: (id: string) => `/v1/payments/${id}`,

  // Credit Notes
  CREDIT_NOTES: '/v1/credit-notes',
  CREDIT_NOTE: (id: string) => `/v1/credit-notes/${id}`,

  // Journal Entries
  JOURNALS: '/v1/journals',
  JOURNAL: (id: string) => `/v1/journals/${id}`,

  // Account Groups
  ACCOUNT_GROUPS: '/v1/account-groups',

  // Warehouses
  WAREHOUSES: '/v1/warehouses',
} as const;
