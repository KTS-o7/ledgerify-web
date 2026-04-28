import Papa from 'papaparse'

export const CSV_TEMPLATE_HEADERS = [
  'date',       // YYYY-MM-DD
  'type',       // income | expense | transfer
  'amount',     // positive number
  'currency',   // ISO 4217 e.g. INR
  'category',   // category name (matched by name or created)
  'account',    // account name (must exist)
  'note',       // optional
]

export function parseCSV(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  return result.data
}

export function generateTemplateCSV(): string {
  const header = CSV_TEMPLATE_HEADERS.join(',')
  const example = '2026-04-01,expense,1500,INR,Food,HDFC Savings,Lunch'
  return `${header}\n${example}\n`
}
