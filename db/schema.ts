import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const gameAccounts = sqliteTable('game_accounts', {
  accountId: text('account_id').primaryKey(),
  ownerId: text('owner_id').unique(),
  guestHash: text('guest_hash').unique(),
  sessionHash: text('session_hash').notNull().unique(),
  generation: integer('generation').notNull().default(1),
  version: integer('version').notNull().default(1),
  commitId: text('commit_id').notNull(),
  accountJson: text('account_json').notNull(),
  battleJson: text('battle_json'),
  updatedAt: integer('updated_at').notNull(),
});

export const gameCommands = sqliteTable('game_commands', {
  accountId: text('account_id').notNull().references(() => gameAccounts.accountId),
  requestId: text('request_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  receiptJson: text('receipt_json').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [primaryKey({ columns: [table.accountId, table.requestId] })]);
