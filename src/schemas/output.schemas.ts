/**
 * JSON Schemas de SALIDA (outputSchema) de cada tool.
 *
 * Derivados de los objetos `*Out` del API Blueprint de Siigo (siigoapi.apib).
 * El objetivo es que un agente que consuma el MCP conozca con exactitud la
 * forma de cada respuesta. Todas las tools devuelven el envoltorio
 * `{ success: boolean, data: <payload> }`.
 */

type JsonSchema = Record<string, unknown>;

// --- Helpers de envoltorio ---------------------------------------------------

/**
 * Envuelve un schema de payload en `{ success, data }`.
 *
 * Nota: NO se marca `required`. El outputSchema documenta la forma para el agente,
 * pero los clientes MCP (p. ej. n8n) validan `structuredContent` de forma estricta:
 * un `required` rompería la respuesta (`-32602`) en error-paths o cuando Siigo omite
 * campos opcionales. Describimos sin exigir.
 */
export function envelope(dataSchema: JsonSchema, dataDescription?: string): JsonSchema {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', description: 'Indica si la operación fue exitosa.' },
      data: dataDescription ? { ...dataSchema, description: dataDescription } : dataSchema,
    },
    additionalProperties: true,
  };
}

const paginationObject: JsonSchema = {
  type: 'object',
  description: 'Metadatos de paginación de Siigo.',
  properties: {
    page: { type: 'number', description: 'Página actual.' },
    page_size: { type: 'number', description: 'Tamaño de página (Siigo usa 25 por defecto).' },
    total_results: { type: 'number', description: 'Total de resultados disponibles.' },
  },
};

const linksObject: JsonSchema = {
  type: 'object',
  description: 'Enlaces de navegación (previous/self/next) con la URL de cada página.',
};

/** Construye el schema de una respuesta paginada `{ pagination, results, _links }`. */
export function paginated(itemSchema: JsonSchema): JsonSchema {
  return envelope({
    type: 'object',
    properties: {
      pagination: paginationObject,
      results: { type: 'array', items: itemSchema, description: 'Resultados de la página actual.' },
      _links: linksObject,
    },
    additionalProperties: true,
  });
}

/** Construye el schema de una respuesta de entidad única. */
export function single(itemSchema: JsonSchema, description?: string): JsonSchema {
  return envelope(itemSchema, description);
}

/** Construye el schema de una respuesta que es un array simple (catálogos). */
export function arrayOf(itemSchema: JsonSchema, description?: string): JsonSchema {
  return envelope({ type: 'array', items: itemSchema }, description);
}

// --- Sub-objetos reutilizables ----------------------------------------------

const taxOut: JsonSchema = {
  type: 'object',
  description: 'Impuesto.',
  properties: {
    id: { type: 'number', description: 'Identificador único del impuesto.' },
    name: { type: 'string', description: 'Nombre del impuesto (ej. IVA 19%).' },
    type: { type: 'string', description: 'Tipo del impuesto (ej. IVA, ReteIVA, ReteICA).' },
    percentage: { type: 'number', description: 'Porcentaje del impuesto.' },
    value: { type: 'number', description: 'Valor del impuesto (en líneas de factura).' },
  },
};

const itemOut: JsonSchema = {
  type: 'object',
  description: 'Ítem (producto o servicio) de un documento.',
  properties: {
    id: { type: 'string', description: 'Identificador del producto/servicio.' },
    code: { type: 'string', description: 'Código único del producto.' },
    description: { type: 'string', description: 'Nombre o descripción del producto/servicio.' },
    quantity: { type: 'number', description: 'Cantidad.' },
    price: { type: 'number', description: 'Valor unitario.' },
    discount: { type: 'object', description: 'Porcentaje y valor de descuento.' },
    taxes: { type: 'array', items: taxOut, description: 'Impuestos asociados al ítem.' },
    total: { type: 'number', description: 'Total del ítem, incluye impuestos.' },
  },
};

const paymentOut: JsonSchema = {
  type: 'object',
  description: 'Forma de pago aplicada.',
  properties: {
    id: { type: 'number', description: 'ID del medio de pago.' },
    name: { type: 'string', description: 'Nombre del medio de pago.' },
    value: { type: 'number', description: 'Valor asociado al medio de pago.' },
    due_date: { type: 'string', description: 'Fecha de pago de la cuota (YYYY-MM-DD).' },
  },
};

const documentRef: JsonSchema = {
  type: 'object',
  description: 'Tipo de comprobante asociado al documento.',
  properties: {
    id: { type: 'number', description: 'Identificador del comprobante.' },
    code: { type: 'string', description: 'Código del comprobante.' },
    name: { type: 'string', description: 'Nombre o título del comprobante.' },
  },
};

const metadata: JsonSchema = {
  type: 'object',
  description: 'Información de auditoría de la entidad (created, last_updated).',
  properties: {
    created: { type: 'string', description: 'Fecha de creación (ISO 8601).' },
    last_updated: { type: 'string', description: 'Fecha de última actualización (ISO 8601).' },
  },
};

// --- Entidades principales ---------------------------------------------------

export const customerSchema: JsonSchema = {
  type: 'object',
  description: 'Cliente / tercero de Siigo.',
  properties: {
    id: { type: 'string', description: 'Identificador del cliente (GUID).' },
    type: { type: 'string', description: 'Tipo de cliente: Customer | Supplier | Other.' },
    person_type: { type: 'string', description: 'Tipo de persona: Person | Company.' },
    id_type: { type: 'object', description: 'Tipo de identificación.' },
    identification: { type: 'string', description: 'Número de identificación del cliente.' },
    check_digit: { type: 'string', description: 'Dígito de verificación.' },
    name: { type: 'array', items: { type: 'string' }, description: 'Razón social o nombres y apellidos.' },
    commercial_name: { type: 'string', description: 'Nombre comercial.' },
    branch_office: { type: 'number', description: 'Sucursal (0 por defecto).' },
    active: { type: 'boolean', description: 'Estado del cliente.' },
    vat_responsible: { type: 'boolean', description: 'Responsable de IVA.' },
    fiscal_responsibilities: { type: 'array', items: { type: 'object' }, description: 'Responsabilidades fiscales.' },
    address: { type: 'object', description: 'Dirección del cliente.' },
    phones: { type: 'array', items: { type: 'object' }, description: 'Teléfonos.' },
    contacts: { type: 'array', items: { type: 'object' }, description: 'Contactos.' },
    related_users: { type: 'object', description: 'Vendedor y cobrador asignados.' },
    metadata,
  },
};

export const productSchema: JsonSchema = {
  type: 'object',
  description: 'Producto o servicio de Siigo.',
  properties: {
    id: { type: 'string', description: 'Identificador del producto (GUID).' },
    code: { type: 'string', description: 'Código único del producto.' },
    name: { type: 'string', description: 'Nombre del producto/servicio.' },
    account_group: { type: 'object', description: 'Clasificación de inventario.' },
    type: { type: 'string', description: 'Tipo de producto (Product, Service, ...).' },
    stock_control: { type: 'boolean', description: 'Indica si maneja control de inventario.' },
    active: { type: 'boolean', description: 'Estado del producto.' },
    tax_included: { type: 'boolean', description: 'IVA incluido en el precio.' },
    taxes: { type: 'array', items: taxOut, description: 'Impuestos asociados.' },
    prices: { type: 'array', items: { type: 'object' }, description: 'Listas de precios (hasta 12).' },
    unit: { type: 'object', description: 'Unidad de medida.' },
    reference: { type: 'string', description: 'Referencia o código de fábrica.' },
    description: { type: 'string', description: 'Descripción del producto.' },
    available_quantity: { type: 'number', description: 'Cantidad disponible en todas las bodegas.' },
    warehouses: { type: 'array', items: { type: 'object' }, description: 'Bodegas asociadas con cantidad.' },
    metadata,
  },
};

export const invoiceSchema: JsonSchema = {
  type: 'object',
  description: 'Factura de venta.',
  properties: {
    id: { type: 'string', description: 'Identificador de la factura (GUID).' },
    document: documentRef,
    number: { type: 'number', description: 'Consecutivo del comprobante.' },
    name: { type: 'string', description: 'Tipo + código + número (ej. FV-2-22).' },
    date: { type: 'string', description: 'Fecha de la factura (YYYY-MM-DD).' },
    customer: { type: 'object', description: 'Cliente asociado a la factura.' },
    cost_center: { type: 'number', description: 'Centro de costo.' },
    currency: { type: 'object', description: 'Moneda y tasa de cambio.' },
    total: { type: 'number', description: 'Total de la factura.' },
    balance: { type: 'number', description: 'Saldo pendiente de pago (0 = pagada).' },
    seller: { type: 'number', description: 'ID del vendedor.' },
    observations: { type: 'string', description: 'Observaciones.' },
    items: { type: 'array', items: itemOut, description: 'Productos/servicios.' },
    payments: { type: 'array', items: paymentOut, description: 'Formas de pago.' },
    public_url: { type: 'string', description: 'URL de la vista pública de la factura.' },
    metadata,
  },
};

export const creditNoteSchema: JsonSchema = {
  type: 'object',
  description: 'Nota crédito.',
  properties: {
    id: { type: 'string', description: 'Identificador de la nota crédito (GUID).' },
    document: documentRef,
    number: { type: 'number', description: 'Consecutivo del comprobante.' },
    name: { type: 'string', description: 'Tipo + código + número (ej. NC-2-22).' },
    date: { type: 'string', description: 'Fecha de la nota crédito (YYYY-MM-DD).' },
    invoice: { type: 'object', description: 'Factura a la que se aplicó la nota crédito.' },
    customer: { type: 'object', description: 'Cliente asociado.' },
    cost_center: { type: 'number', description: 'Centro de costo.' },
    total: { type: 'number', description: 'Total de la nota crédito.' },
    seller: { type: 'number', description: 'ID del vendedor.' },
    items: { type: 'array', items: itemOut, description: 'Productos/servicios.' },
    payments: { type: 'array', items: paymentOut, description: 'Formas de pago.' },
    metadata,
  },
};

export const voucherSchema: JsonSchema = {
  type: 'object',
  description: 'Recibo de caja (pago recibido de un cliente).',
  properties: {
    id: { type: 'string', description: 'Identificador del recibo de caja (GUID).' },
    document: documentRef,
    number: { type: 'number', description: 'Consecutivo del comprobante.' },
    name: { type: 'string', description: 'Tipo + código + número (ej. RC-2-22).' },
    date: { type: 'string', description: 'Fecha de elaboración (YYYY-MM-DD).' },
    type: { type: 'string', description: 'Tipo de recibo de caja.' },
    customer: { type: 'object', description: 'Cliente asociado.' },
    currency: { type: 'object', description: 'Moneda extranjera.' },
    items: { type: 'array', items: { type: 'object' }, description: 'Facturas a las que se aplicó el abono.' },
    payment: { type: 'object', description: 'ID y valor de la forma de pago.' },
    balance: { type: 'number', description: 'Saldo del recibo de caja.' },
    observations: { type: 'string', description: 'Observaciones.' },
    metadata,
  },
};

export const paymentReceiptSchema: JsonSchema = {
  type: 'object',
  description: 'Recibo de pago/egreso (pago realizado a un proveedor).',
  properties: {
    id: { type: 'string', description: 'Identificador del recibo de pago/egreso (GUID).' },
    document: documentRef,
    number: { type: 'number', description: 'Consecutivo del comprobante.' },
    name: { type: 'string', description: 'Tipo + código + número (ej. RP-1-22).' },
    date: { type: 'string', description: 'Fecha de elaboración (YYYY-MM-DD).' },
    type: { type: 'string', description: 'Tipo de recibo de pago.' },
    supplier: { type: 'object', description: 'Proveedor asociado.' },
    items: { type: 'array', items: { type: 'object' }, description: 'Documentos a los que se aplicó el pago.' },
    payment: { type: 'object', description: 'ID y valor de la forma de pago.' },
    balance: { type: 'number', description: 'Saldo del recibo.' },
    observations: { type: 'string', description: 'Observaciones.' },
    metadata,
  },
};

export const journalSchema: JsonSchema = {
  type: 'object',
  description: 'Comprobante contable.',
  properties: {
    id: { type: 'string', description: 'Identificador del comprobante (GUID).' },
    document: documentRef,
    number: { type: 'number', description: 'Consecutivo del comprobante.' },
    name: { type: 'string', description: 'Tipo + código + número (ej. CC-1-22).' },
    date: { type: 'string', description: 'Fecha del comprobante (YYYY-MM-DD).' },
    items: { type: 'array', items: { type: 'object' }, description: 'Movimientos contables (débitos/créditos por cuenta).' },
    observations: { type: 'string', description: 'Observaciones.' },
    metadata,
  },
};

// --- Catálogos ---------------------------------------------------------------

export const taxSchema: JsonSchema = {
  type: 'object',
  description: 'Tipo de impuesto configurado en Siigo.',
  properties: {
    id: { type: 'number', description: 'Identificador único del impuesto.' },
    name: { type: 'string', description: 'Nombre del impuesto.' },
    type: { type: 'string', description: 'Tipo del impuesto.' },
    percentage: { type: 'number', description: 'Porcentaje del impuesto.' },
    active: { type: 'boolean', description: 'Indica si el impuesto está en uso.' },
  },
};

export const documentTypeSchema: JsonSchema = {
  type: 'object',
  description: 'Tipo de documento/comprobante configurado en Siigo.',
  properties: {
    id: { type: 'number', description: 'Identificador único del tipo de documento (se usa al crear documentos).' },
    code: { type: 'string', description: 'Código asignado en Siigo.' },
    name: { type: 'string', description: 'Nombre del tipo de documento.' },
    description: { type: 'string', description: 'Descripción.' },
    type: { type: 'string', description: 'Tipo (FV, NC, FC, DS, RC, RP, CC, C).' },
    active: { type: 'boolean', description: 'Estado del tipo de documento.' },
    cost_center: { type: 'boolean', description: 'Si maneja centros de costo.' },
    cost_center_mandatory: { type: 'boolean', description: 'Si el centro de costo es obligatorio.' },
    automatic_number: { type: 'boolean', description: 'Si maneja numeración automática (si es false, enviar number al crear).' },
    consecutive: { type: 'number', description: 'Próximo consecutivo.' },
    discount_type: { type: 'string', description: 'Tipo de descuento: Percentage | Value.' },
    decimals: { type: 'boolean', description: 'Si maneja decimales.' },
  },
};

export const paymentTypeSchema: JsonSchema = {
  type: 'object',
  description: 'Forma/medio de pago.',
  properties: {
    id: { type: 'number', description: 'Identificador único de la forma de pago.' },
    name: { type: 'string', description: 'Nombre de la forma de pago.' },
    type: { type: 'string', description: 'Tipo de la forma de pago.' },
    active: { type: 'boolean', description: 'Estado.' },
    due_date: { type: 'boolean', description: 'Si maneja fecha de vencimiento.' },
  },
};

export const costCenterSchema: JsonSchema = {
  type: 'object',
  description: 'Centro de costo.',
  properties: {
    id: { type: 'number', description: 'Identificador único.' },
    code: { type: 'string', description: 'Código del centro de costo.' },
    name: { type: 'string', description: 'Nombre del centro de costo.' },
    active: { type: 'boolean', description: 'Estado.' },
  },
};

export const userSchema: JsonSchema = {
  type: 'object',
  description: 'Usuario o vendedor de Siigo.',
  properties: {
    id: { type: 'number', description: 'Identificador único del usuario/vendedor.' },
    username: { type: 'string', description: 'Nombre de usuario.' },
    first_name: { type: 'string', description: 'Nombre.' },
    last_name: { type: 'string', description: 'Apellido.' },
    email: { type: 'string', description: 'Correo.' },
    active: { type: 'boolean', description: 'Estado del usuario.' },
    identification: { type: 'string', description: 'Número de identificación.' },
  },
};

// --- Recursos adicionales ----------------------------------------------------

export const purchaseSchema: JsonSchema = {
  type: 'object',
  description: 'Factura de compra / gasto.',
  properties: {
    id: { type: 'string', description: 'Identificador (GUID).' },
    document: documentRef,
    number: { type: 'number', description: 'Consecutivo.' },
    name: { type: 'string', description: 'Tipo + código + número (ej. FC-3-1328).' },
    date: { type: 'string', description: 'Fecha (YYYY-MM-DD).' },
    supplier: { type: 'object', description: 'Proveedor (id, identification, branch_office).' },
    provider_invoice: { type: 'object', description: 'Factura del proveedor (prefix, number).' },
    cost_center: { type: 'number', description: 'Centro de costo.' },
    total: { type: 'number', description: 'Total de la compra.' },
    balance: { type: 'number', description: 'Saldo pendiente de pago.' },
    discount_type: { type: 'string' },
    items: { type: 'array', items: itemOut, description: 'Conceptos/cuentas del gasto.' },
    observations: { type: 'string' },
    metadata,
  },
};

export const quotationSchema: JsonSchema = {
  type: 'object',
  description: 'Cotización.',
  properties: {
    id: { type: 'string', description: 'Identificador (GUID).' },
    document: documentRef,
    number: { type: 'number', description: 'Consecutivo.' },
    name: { type: 'string', description: 'Tipo + código + número (ej. C-1-22).' },
    date: { type: 'string', description: 'Fecha (YYYY-MM-DD).' },
    customer: { type: 'object', description: 'Cliente asociado.' },
    seller: { type: 'number', description: 'ID del vendedor.' },
    total: { type: 'number' },
    items: { type: 'array', items: itemOut },
    metadata,
  },
};

export const supportDocumentSchema: JsonSchema = {
  type: 'object',
  description: 'Documento soporte (compra a no obligados a facturar).',
  properties: {
    id: { type: 'string', description: 'Identificador (GUID).' },
    document: documentRef,
    number: { type: 'number' },
    name: { type: 'string' },
    date: { type: 'string', description: 'Fecha (YYYY-MM-DD).' },
    supplier: { type: 'object', description: 'Proveedor.' },
    total: { type: 'number' },
    balance: { type: 'number' },
    items: { type: 'array', items: itemOut },
    metadata,
  },
};

export const accountGroupSchema: JsonSchema = {
  type: 'object',
  description: 'Categoría / grupo de inventario.',
  properties: {
    id: { type: 'number', description: 'Identificador único.' },
    name: { type: 'string', description: 'Nombre de la categoría.' },
    active: { type: 'boolean', description: 'Estado.' },
  },
};

export const warehouseSchema: JsonSchema = {
  type: 'object',
  description: 'Bodega.',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    active: { type: 'boolean' },
    has_movements: { type: 'boolean' },
  },
};

export const priceListSchema: JsonSchema = {
  type: 'object',
  description: 'Lista de precio.',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    position: { type: 'number' },
    active: { type: 'boolean' },
  },
};

export const fixedAssetSchema: JsonSchema = {
  type: 'object',
  description: 'Activo fijo.',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    group: { type: 'object' },
    active: { type: 'boolean' },
  },
};

export const webhookSchema: JsonSchema = {
  type: 'object',
  description: 'Webhook configurado.',
  properties: {
    id: { type: 'string' },
    url: { type: 'string' },
    application_id: { type: 'string' },
    company_key: { type: 'string' },
  },
};

// Catálogos simples (estructura variable) — objeto genérico
export const genericObject: JsonSchema = { type: 'object', description: 'Registro del catálogo.' };
