import fs from "fs";
import path from "path";
import { Pool, PoolClient } from "pg";
import { ingestZip } from "./ingestZip";
import { parseExcels } from "./excelParser";
import { indexDocuments } from "./documentIndexer";

async function ensureSchema(client: PoolClient) {
  const sqlPath = path.join(__dirname, "..", "schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await client.query(sql);
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : undefined,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB
  });

  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await ingestZip(client);
    await parseExcels(client);
    await indexDocuments(client);
    console.log("RUN_OK");
    process.exit(0);
  } catch (err: any) {
    console.error("RUN_FAIL", err?.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("RUN_FAIL", err?.message || err);
  process.exit(1);
});

