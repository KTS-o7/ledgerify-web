import { pgTable, uuid, varchar, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const accountTypeEnum = pgEnum('account_type', ['bank', 'wallet', 'cash', 'savings'])

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 4 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
