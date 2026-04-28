import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const accountTypeEnum = pgEnum('account_type', ['bank', 'wallet', 'cash', 'savings'])

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
