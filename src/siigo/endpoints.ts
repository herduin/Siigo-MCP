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
  INVOICE_ANNUL: (id: string) => `/v1/invoices/${id}/annul`,
  INVOICE_MAIL: (id: string) => `/v1/invoices/${id}/mail`,
  INVOICES_BATCH: '/v1/invoices/batch',

  // Products
  PRODUCTS: '/v1/products',
  PRODUCT: (id: string) => `/v1/products/${id}`,

  // Quotations
  QUOTATIONS: '/v1/quotations',
  QUOTATION: (id: string) => `/v1/quotations/${id}`,

  // Purchases (facturas de compra / gasto)
  PURCHASES: '/v1/purchases',
  PURCHASE: (id: string) => `/v1/purchases/${id}`,

  // Purchase support documents (documento soporte)
  SUPPORT_DOCS: '/v1/purchase-support-documents',
  SUPPORT_DOC: (id: string) => `/v1/purchase-support-documents/${id}`,

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
  ACCOUNT_GROUP: (id: number) => `/v1/account-groups/${id}`,

  // Catalogs
  WAREHOUSES: '/v1/warehouses',
  PRICE_LISTS: '/v1/price-lists',
  CITIES: '/v1/cities',
  ID_TYPES: '/v1/id-types',
  FISCAL_RESPONSIBILITIES: '/v1/fiscal-responsibilities',
  FIXED_ASSETS: '/v1/fixed-assets',

  // Webhooks
  WEBHOOKS: '/v1/webhooks',
  WEBHOOK: (id: string) => `/v1/webhooks/${id}`,

  // Accounting reports
  TRIAL_BALANCE: '/v1/test-balance-report',
  TRIAL_BALANCE_BY_THIRD: '/v1/test-balance-report-by-thirdparty',
  ACCOUNTS_PAYABLE: '/v1/accounts-payable',
} as const;
