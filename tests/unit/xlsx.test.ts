import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseXlsxRows, buildProfitAndLoss } from '../../src/utils/xlsx';

// Construye un .xlsx mínimo en memoria con celdas SIN atributo `r` (como Siigo).
function makeXlsx(rows: string[][]): Uint8Array {
  const cell = (v: string) =>
    v === '' ? '<x:c/>' : `<x:c t="str"><x:v>${v}</x:v></x:c>`;
  const xmlRows = rows.map((r) => `<x:row>${r.map(cell).join('')}</x:row>`).join('');
  const sheet =
    '<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<x:sheetData>${xmlRows}</x:sheetData></x:worksheet>`;
  return zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet) });
}

describe('xlsx parser + P&L', () => {
  it('parsea celdas por posición (sin ref r)', () => {
    const data = makeXlsx([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
    const rows = parseXlsxRows(data);
    expect(rows[0]).toEqual(['a', 'b', 'c']);
    expect(rows[1]).toEqual(['1', '', '3']);
  });

  it('construye el P&L con la convención PUC de Siigo', () => {
    // Columnas: 0 nivel, 1, 2 código, 3 nombre, 4-6, 7 saldo final
    const rows = [
      ['EXUSMULTIMEDIA S.A.S.'],
      ['De enero 2026 a mayo 2026'],
      ['Clase', 'No', '4', 'Ingresos', '', '', '', '-1000'], // ingreso crédito → 1000
      ['Grupo', 'No', '41', 'Ingresos ordinarios', '', '', '', '-1000'],
      ['Clase', 'No', '5', 'Gastos', '', '', '', '300'],
      ['Grupo', 'No', '51', 'Administrativos', '', '', '', '300'],
      ['Clase', 'No', '6', 'Costo de ventas', '', '', '', '0'],
    ];
    const pnl = buildProfitAndLoss(rows as string[][]);
    expect(pnl.company).toBe('EXUSMULTIMEDIA S.A.S.');
    expect(pnl.income).toBe(1000);
    expect(pnl.expenses).toBe(300);
    expect(pnl.netProfit).toBe(700);
    expect(pnl.netMarginPct).toBeCloseTo(70);
    expect(pnl.incomeByGroup[0]).toMatchObject({ code: '41', value: 1000 });
    expect(pnl.expensesByGroup[0]).toMatchObject({ code: '51', value: 300 });
  });
});
