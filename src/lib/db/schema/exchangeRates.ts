import { pgTable, varchar, numeric, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const exchangeRates = pgTable('exchange_rates', {
  base: varchar('base', { length: 3 }).notNull(),
  target: varchar('target', { length: 3 }).notNull(),
  rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.base, t.target] })])

export type ExchangeRate = typeof exchangeRates.$inferSelect
