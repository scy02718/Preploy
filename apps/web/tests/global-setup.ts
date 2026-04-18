import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://test:test@localhost:5433/preploy_test";

export async function setup() {
  const client = postgres(TEST_DB_URL, { prepare: false, max: 1 });
  const db = drizzle(client);

  // Drop all schemas to get a clean slate, then re-migrate
  await client.unsafe(`
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO test;
  `);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../drizzle"),
  });

  await client.end();
}
