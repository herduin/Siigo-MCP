import { unzipSync, strFromU8 } from 'fflate';

/**
 * Parser mínimo de .xlsx (sin dependencias pesadas).
 *
 * Los reportes de Siigo (balance de prueba) llegan como un .xlsx cuyas celdas
 * NO traen el atributo de referencia `r`, por lo que las columnas se mapean por
 * POSICIÓN secuencial dentro de cada fila. Los strings vienen inline
 * (`t="str"` con `<v>` directo), no en sharedStrings.
 *
 * Devuelve la primera hoja como una matriz de strings (filas × columnas).
 */
export function parseXlsxRows(data: Uint8Array): string[][] {
  const files = unzipSync(data);
  const sheetKey = Object.keys(files).find((k) => /xl\/worksheets\/sheet1\.xml$/i.test(k));
  if (!sheetKey) return [];
  const xml = strFromU8(files[sheetKey]);

  const rows: string[][] = [];
  // Cada <row>...</row> (con o sin prefijo de namespace, p.ej. x:row)
  const rowRe = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g;
  const cellRe = /<(?:\w+:)?c\b[^>]*?(\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
  const valRe = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const inner = rowMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(inner)) !== null) {
      const body = cellMatch[2] || '';
      const v = valRe.exec(body);
      cells.push(v ? decodeEntities(v[1]) : '');
    }
    if (cells.some((c) => c !== '')) rows.push(cells);
  }
  return rows;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export interface ProfitAndLoss {
  company?: string;
  period?: string;
  income: number;
  costOfSales: number;
  productionCost: number;
  expenses: number;
  netProfit: number;
  netMarginPct: number | null;
  incomeByGroup: Array<{ code: string; name: string; value: number }>;
  expensesByGroup: Array<{ code: string; name: string; value: number }>;
}

/**
 * Construye un Estado de Resultados (P&L) a partir de las filas del balance de
 * prueba general de Siigo. Columnas: 0 nivel, 2 código, 3 nombre, 7 saldo final.
 * Convención PUC: clase 4 = ingresos (saldo crédito → negativo, se invierte),
 * 5 = gastos, 6 = costo de ventas, 7 = costo de producción.
 */
export function buildProfitAndLoss(rows: string[][]): ProfitAndLoss {
  const num = (x: string | undefined) => {
    const n = parseFloat((x ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const clase: Record<string, number> = {};
  const grupos: Record<string, { name: string; value: number }> = {};
  let company: string | undefined;
  let period: string | undefined;

  for (const r of rows) {
    const nivel = (r[0] ?? '').trim();
    const code = (r[2] ?? '').trim();
    const name = (r[3] ?? '').trim();
    const saldoFinal = num(r[7]);

    // Metadatos: filas iniciales con una sola celda
    if (r.length === 1) {
      const only = (r[0] ?? '').trim();
      if (/^\d{9,}$/.test(only)) {
        // NIT — ignorar
      } else if (/^De\s.+\sa\s.+$/i.test(only)) {
        period = only;
      } else if (only && !company && !/balance/i.test(only)) {
        company = only;
      }
    }

    if (nivel === 'Clase' && ['4', '5', '6', '7'].includes(code)) {
      clase[code] = saldoFinal;
    }
    if (nivel === 'Grupo' && code.length === 2 && ['4', '5', '6', '7'].includes(code[0])) {
      grupos[code] = { name, value: saldoFinal };
    }
  }

  const income = -(clase['4'] ?? 0); // ingresos: crédito (negativo) → positivo
  const costOfSales = clase['6'] ?? 0;
  const productionCost = clase['7'] ?? 0;
  const expenses = clase['5'] ?? 0;
  const netProfit = income - costOfSales - productionCost - expenses;

  return {
    company,
    period,
    income,
    costOfSales,
    productionCost,
    expenses,
    netProfit,
    netMarginPct: income ? (netProfit / income) * 100 : null,
    incomeByGroup: Object.entries(grupos)
      .filter(([c]) => c[0] === '4')
      .map(([code, g]) => ({ code, name: g.name, value: -g.value })),
    expensesByGroup: Object.entries(grupos)
      .filter(([c]) => ['5', '6', '7'].includes(c[0]))
      .map(([code, g]) => ({ code, name: g.name, value: g.value })),
  };
}
