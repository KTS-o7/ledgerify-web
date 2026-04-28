import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense'])

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: categoryTypeEnum('type').notNull(),
  icon: varchar('icon', { length: 64 }),
  color: varchar('color', { length: 7 }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
