import { pgTable, uuid, varchar, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete'])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: auditActionEnum('action').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
