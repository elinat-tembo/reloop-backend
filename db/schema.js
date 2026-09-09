const {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
} = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  contactDetails: varchar('contact_details', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const clothingItems = pgTable('clothing_items', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id),
  type: varchar('type', { length: 100 }).notNull(),
  brand: varchar('brand', { length: 100 }),
  size: varchar('size', { length: 50 }),
  condition: varchar('condition', { length: 50 }),
  estimatedValue: numeric('estimated_value'),
  images: text('images').array(),
  city: varchar('city', { length: 255 }),
  region: varchar('region', { length: 255 }),
  availability: varchar('availability', { length: 50 }).notNull().default('available'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const swapRequests = pgTable('swap_requests', {
  id: serial('id').primaryKey(),
  fromUserId: integer('from_user_id')
    .notNull()
    .references(() => users.id),
  toUserId: integer('to_user_id')
    .notNull()
    .references(() => users.id),
  requestedItemId: integer('requested_item_id')
    .notNull()
    .references(() => clothingItems.id),
  offeredItemId: integer('offered_item_id')
    .notNull()
    .references(() => clothingItems.id),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  swapRequestId: integer('swap_request_id')
    .notNull()
    .references(() => swapRequests.id),
  senderId: integer('sender_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

module.exports = {
  users,
  clothingItems,
  swapRequests,
  messages,
};
