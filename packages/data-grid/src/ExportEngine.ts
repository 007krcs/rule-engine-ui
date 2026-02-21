export interface ExportColumn {
  key: string;
  title?: string;
}

export function exportToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn[],
): string {
  const header = columns.map((column) => escapeCsv(column.title ?? column.key)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const value = row[column.key];
          return escapeCsv(value == null ? '' : String(value));
        })
        .join(','),
    )
    .join('\n');
  return `${header}\n${body}`;
}

export function exportToExcelXml<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn[],
): string {
  const headerCells = columns
    .map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.title ?? column.key)}</Data></Cell>`)
    .join('');
  const rowCells = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = row[column.key];
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${escapeXml(value == null ? '' : String(value))}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<Worksheet ss:Name="Sheet1"><Table>',
    `<Row>${headerCells}</Row>`,
    rowCells,
    '</Table></Worksheet></Workbook>',
  ].join('');
}

function escapeCsv(value: string): string {
  if (!/[,"\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
