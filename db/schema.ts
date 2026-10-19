import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const zoomConnections = sqliteTable('zoom_connections', {
  ownerId: text('owner_id').primaryKey(),
  zoomUserId: text('zoom_user_id').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  tokenCipher: text('token_cipher').notNull(),
  expiresAt: integer('expires_at').notNull(),
  refreshOwner: text('refresh_owner'),
  refreshUntil: integer('refresh_until'),
}, table => [index('zoom_user_index').on(table.zoomUserId)]);

export const zoomOAuthStates = sqliteTable('zoom_oauth_states', {
  stateHash: text('state_hash').primaryKey(),
  ownerId: text('owner_id').notNull(),
  browserHash: text('browser_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
