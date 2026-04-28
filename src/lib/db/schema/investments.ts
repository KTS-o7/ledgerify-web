import { pgTable, uuid, varchar, numeric, date, timestamp, pgEnum, jsonb, text } from 'drizzle-orm/pg-core'
import { users } from './users'

export const assetTypeEnum = pgEnum('asset_type', [
  'stock', 'mf', 'crypto', 'fd', 'ppf', 'nps', 'gold', 'silver', 'real_estate', 'savings', 'other'
])
export const investmentTxTypeEnum = pgEnum('investment_tx_type', ['buy', 'sell', 'dividend', 'interest', 'bonus'])

export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  assetType: assetTypeEnum('asset_type').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }),
  buyPrice: numeric('buy_price', { precision: 18, scale: 4 }),
  currentPrice: numeric('current_price', { precision: 18, scale: 4 }),
  currentPriceUpdatedAt: timestamp('current_price_updated_at', { withTimezone: true }),
  maturityDate: date('maturity_date'),
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const investmentTransactions = pgTable('investment_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  investmentId: uuid('investment_id').notNull().references(() => investments.id),
  type: investmentTxTypeEnum('type').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }),
  price: numeric('price', { precision: 18, scale: 4 }),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  date: date('date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Investment = typeof investments.$inferSelect
export type NewInvestment = typeof investments.$inferInsert
