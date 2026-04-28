import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 64 }).notNull(),
  color: varchar('color', { length: 7 }),
})

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
