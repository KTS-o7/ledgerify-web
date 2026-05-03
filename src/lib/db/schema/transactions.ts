import { pgTable, uuid, varchar, numeric, boolean, date, timestamp, pgEnum, text, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'
import { accounts } from './accounts'
import { categories } from './categories'
import { tags } from './tags'

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer', 'credit_payment'])

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  convertedAmount: numeric('converted_amount', { precision: 18, scale: 4 }),
  baseCurrency: varchar('base_currency', { length: 3 }),
  categoryId: uuid('category_id').references(() => categories.id),
  note: text('note'),
  title: varchar('title', { length: 255 }),
  recurrenceInterval: numeric('recurrence_interval', { precision: 5, scale: 0 }),
  recurrenceUnit: varchar('recurrence_unit', { length: 10 }),
  parentRecurringId: uuid('parent_recurring_id'),
  date: date('date').notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurrenceRule: varchar('recurrence_rule', { length: 255 }),
  transferToId: uuid('transfer_to_id').references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const transactionTags = pgTable('transaction_tags', {
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  tagId: uuid('tag_id').notNull().references(() => tags.id),
}, (t) => [primaryKey({ columns: [t.transactionId, t.tagId] })])

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
