import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to the Supabase Session Pooler URL before running Drizzle commands.");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle-postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
