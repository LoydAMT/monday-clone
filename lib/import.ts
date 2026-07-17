import ExcelJS from 'exceljs';

// Only the first column of the first sheet is read — this is specifically
// for the "one title per row" import case (see ImportItemsDialog), not a
// general spreadsheet importer. .xlsx only (exceljs can't read legacy
// binary .xls).
export async function parseExcelFirstColumn(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const values: string[] = [];
  sheet.eachRow((row) => {
    const text = cellText(row.getCell(1).value);
    if (text) values.push(text);
  });
  return values;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim();
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    return '';
  }
  return String(value).trim();
}
