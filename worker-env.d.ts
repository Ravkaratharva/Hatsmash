interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface Fetcher {
  fetch(input: Request): Promise<Response>;
}

interface CloudflareEnv {
  DB: D1Database;
}

declare module "cloudflare:workers" {
  export const env: CloudflareEnv;
}
