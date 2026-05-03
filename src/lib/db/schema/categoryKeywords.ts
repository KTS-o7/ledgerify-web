import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'
import { categories } from './categories'

export const categoryKeywords = pgTable('category_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  keyword: varchar('keyword', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CategoryKeyword = typeof categoryKeywords.$inferSelect
