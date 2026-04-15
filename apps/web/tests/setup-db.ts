import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/schema";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://test:test@localhost:5433/interview_assistant_test";

let client: ReturnType<typeof postgres> | null = null;

export function getTestDb() {
  if (!client) {
    client = postgres(TEST_DB_URL, { prepare: false });
  }
  return drizzle(client, { schema });
}

export async function cleanupTestDb() {
  const db = getTestDb();
  await db.delete(schema.sessionTemplates);
  await db.delete(schema.companyQuestions);
  await db.delete(schema.userResumes);
  await db.delete(schema.interviewPlans);
  await db.delete(schema.sessionFeedback);
  await db.delete(schema.transcripts);
  await db.delete(schema.codeSnapshots);
  await db.delete(schema.interviewSessions);
  await db.delete(schema.interviewUsage);
  await db.delete(schema.accounts);
  await db.delete(schema.users);
}

export async function teardownTestDb() {
  if (client) {
    await client.end();
    client = null;
  }
}
