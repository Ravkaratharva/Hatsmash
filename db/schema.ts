import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ScanResult } from "../lib/scan-schema.js";

export const profiles = pgTable("profiles", {
  // Prompt 5B will reference auth.users.id once Supabase Auth is connected.
  // It intentionally remains unconstrained while this task is database-only.
  id: uuid("id").primaryKey(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const scans = pgTable("scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  url: text("url").notNull(),
  score: integer("score").notNull(),
  scores: jsonb("scores").$type<ScanResult["scores"]>().notNull(),
  findings: jsonb("findings").$type<ScanResult["findings"]>().notNull(),
  ipHash: text("ip_hash"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
}).enableRLS();

export const capturedEmails = pgTable(
  "captured_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    scanId: uuid("scan_id").notNull().references(() => scans.id),
    source: text("source").notNull().default("fix-prompt-unlock"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("captured_emails_scan_id_idx").on(table.scanId)],
).enableRLS();
