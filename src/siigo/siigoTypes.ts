// Siigo API Types based on https://siigoapi.docs.apiary.io

export interface SiigoAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface SiigoCustomer {
  id: string;
  type: string;
  person_type: string;
  id_type: string;
  identification: string;
  branch_office?: number;
  name: string[];
  commercial_name?: string;
  active: boolean;
  vat_responsible: boolean;
  fiscal_responsibilities: Array<{ code: string; name: string }>;
  address: {
    address: string;
    city: { country_code: string; country_name: string; state_code: string; state_name: string; city_code: string; city_name: string };
    postal_code?: string;
  };
  phones?: Array<{ indicative: string; number: string; extension?: string }>;
  contacts?: Array<{ first_name: string; last_name: string; email: string; phone?: { indicative: string; number: string } }>;
  comments?: string;
  related_users?: { seller_id?: number; collector_id?: number };
}

export interface SiigoInvoice {
  id: string;
  document: { id: number };
  number: number;
  name: string;
  date: string;
  customer: {
    identification: string;
    branch_office: number;
  };
  cost_center?: number;
  currency: { code: string; exchange_rate: number };
  total: number;
  balance: number;
  seller?: number;
  stamp: {
    status?: string;
    electronic_invoice_status?: string;
  };
  mail?: {
    status?: string;
  };
  observations?: string;
  items: Array<{
    code: string;
    description: string;
    quantity: number;
    price: number;
    discount?: number;
    taxes?: Array<{ id: number; name: string; percentage: number; value: number }>;
    total: number;
  }>;
  payments?: Array<{
    id: number;
    name: string;
    value: number;
    due_date?: string;
  }>;
}

export interface SiigoProduct {
  id: string;
  code: string;
  name: string;
  account_group?: { id: number; name: string };
  type: string;
  stock_control: boolean;
  active: boolean;
  tax_classification: string;
  tax_included: boolean;
  tax_consumption_value?: number;
  taxes?: Array<{ id: number; name: string; percentage: number }>;
  prices?: Array<{ currency_code: string; price_list: Array<{ position: number; value: number }> }>;
  unit?: string;
  unit_label?: string;
  reference?: string;
  description?: string;
  additional_fields?: Record<string, unknown>;
  available_quantity?: number;
}

export interface SiigoTax {
  id: number;
  name: string;
  type: string;
  percentage: number;
  description?: string;
}

export interface SiigoUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  active: boolean;
  identification: string;
  role: string;
}

export interface SiigoPayment {
  id: string;
  type: string;
  name: string;
  date: string;
  customer: {
    identification: string;
    branch_office: number;
  };
  total: number;
  observations?: string;
  payments: Array<{
    invoice_id: string;
    value: number;
  }>;
}

export interface SiigoCreditNote {
  id: string;
  document: { id: number };
  number: number;
  date: string;
  customer: {
    identification: string;
    branch_office: number;
  };
  total: number;
  observations?: string;
  related_invoice?: string;
}

export interface SiigoJournalEntry {
  id: string;
  number: number;
  date: string;
  observations?: string;
  total_debit: number;
  total_credit: number;
  items: Array<{
    account: { code: string; name: string };
    debit: number;
    credit: number;
    cost_center?: number;
  }>;
}

export interface SiigoDocumentType {
  id: number;
  name: string;
  type: string;
  active: boolean;
}

export interface SiigoPaymentMethod {
  id: number;
  name: string;
  type: string;
  active: boolean;
}

export interface SiigoCostCenter {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

export interface SiigoSeller {
  id: number;
  identification: string;
  first_name: string;
  last_name: string;
  observations?: string;
}

export interface SiigoAccountReceivable {
  customer: {
    identification: string;
    name: string;
  };
  invoices: Array<{
    id: string;
    number: number;
    date: string;
    due_date: string;
    total: number;
    balance: number;
    days_overdue: number;
  }>;
  total_balance: number;
}

export interface SiigoApiError {
  Status: number;
  Message: string;
  Errors?: Array<{ Field?: string; Message: string }>;
}
