import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Abuse-control state only. This table never stores raw IP addresses, email
 * addresses, Supabase identities, session tokens, or account/profile data.
 */
export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    keyHash: text("key_hash").notNull(),
    action: text("action").notNull(),
    windowStartedAt: integer("window_started_at").notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyHash, table.action] }),
    index("idx_auth_rate_limits_expires_at").on(table.expiresAt),
  ],
);
