// Drizzle schema for Yoonu Bus
export * from './auth-schema'

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const places = sqliteTable('places', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  area: text('area').notNull(),
  detail: text('detail'),
  isStop: integer('is_stop', { mode: 'boolean' }).notNull().default(false),
})

export const busLines = sqliteTable('bus_lines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  direction: text('direction').notNull(),
  fromPlace: text('from_place').notNull(),
  toPlace: text('to_place').notNull(),
  durationMin: integer('duration_min').notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(true),
})

export const busStops = sqliteTable('bus_stops', {
  id: text('id').primaryKey(),
  lineId: text('line_id').notNull(),
  name: text('name').notNull(),
  order: integer('order').notNull(),
  walkInfo: text('walk_info'),
})

export const savedItems = sqliteTable('saved_items', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  deviceId: text('device_id'),
  kind: text('kind').notNull(),
  refId: text('ref_id').notNull(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  createdAt: text('created_at').notNull(),
})

export const contributions = sqliteTable('contributions', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  lineName: text('line_name'),
  message: text('message').notNull(),
  status: text('status').notNull().default('reçue'),
  points: integer('points').notNull().default(0),
  createdAt: text('created_at').notNull(),
})

export const otpCodes = sqliteTable('otp_codes', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: text('expires_at').notNull(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
})

export type Place = typeof places.$inferSelect
export type BusLine = typeof busLines.$inferSelect
export type BusStop = typeof busStops.$inferSelect
