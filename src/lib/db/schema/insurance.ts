import { pgTable, uuid, varchar, numeric, date, timestamp, pgEnum, text } from 'drizzle-orm/pg-core'
import { users } from './users'

export const policyTypeEnum = pgEnum('policy_type', ['life', 'health', 'vehicle', 'property', 'term', 'other'])
export const premiumFrequencyEnum = pgEnum('premium_frequency', ['monthly', 'quarterly', 'annual'])
export const insurancePaymentStatusEnum = pgEnum('insurance_payment_status', ['paid', 'due', 'missed'])

export const insurancePolicies = pgTable('insurance_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }),
  policyType: policyTypeEnum('policy_type').notNull(),
  premiumAmount: numeric('premium_amount', { precision: 18, scale: 4 }).notNull(),
  premiumFrequency: premiumFrequencyEnum('premium_frequency').notNull(),
  coverageAmount: numeric('coverage_amount', { precision: 18, scale: 4 }),
  currency: varchar('currency', { length: 3 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  renewalDate: date('renewal_date'),
  nominee: varchar('nominee', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const insurancePayments = pgTable('insurance_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => insurancePolicies.id),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  status: insurancePaymentStatusEnum('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type InsurancePolicy = typeof insurancePolicies.$inferSelect
export type NewInsurancePolicy = typeof insurancePolicies.$inferInsert
