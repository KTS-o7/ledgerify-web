import { pgTable, uuid, varchar, numeric, date, boolean, timestamp, pgEnum, text } from 'drizzle-orm/pg-core'
import { users } from './users'
import { categories } from './categories'
import { accounts } from './accounts'

export const periodTypeEnum = pgEnum('period_type', ['monthly', 'weekly'])
export const goalStatusEnum = pgEnum('goal_status', ['active', 'achieved', 'abandoned'])

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  categoryId: uuid('category_id').references(() => categories.id),
  name: varchar('name', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  periodType: periodTypeEnum('period_type').notNull(),
  periodAnchorDate: date('period_anchor_date'),
  rollover: boolean('rollover').notNull().default(false),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const savingsGoals = pgTable('savings_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  targetAmount: numeric('target_amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  linkedAccountId: uuid('linked_account_id').references(() => accounts.id),
  deadline: date('deadline'),
  status: goalStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Budget = typeof budgets.$inferSelect
export type SavingsGoal = typeof savingsGoals.$inferSelect
