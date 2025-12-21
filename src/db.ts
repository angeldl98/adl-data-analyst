import "dotenv/config";
import fs from "fs";
import { Client } from "pg";
import type { ClientConfig } from "pg";

let client: Client | null = null;
const LOCAL_PW_PATH = "/opt/adl-suite/data/secrets/postgres.password";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readLocalPassword(): string | null {
  try {
    if (fs.existsSync(LOCAL_PW_PATH)) {
      return fs.readFileSync(LOCAL_PW_PATH, "utf8").trim();
    }
  } catch (err: any) {
    console.error("Unable to read local Postgres password file", { error: err?.message });
  }
  return null;
}

function buildConfig(): ClientConfig {
  let urlValue = process.env.DATABASE_URL?.trim();
  if (!urlValue || urlValue === "") {
    if (!process.env.DOCKER_ENV) {
      const pw = readLocalPassword();
      if (!pw) {
        fail("DATABASE_URL is missing and local password file could not be read. Provide .env or /opt/adl-suite/data/secrets/postgres.password.");
      }
      urlValue = `postgresql://adl:${encodeURIComponent(pw)}@127.0.0.1:5432/adl_core`;
      console.warn("DATABASE_URL not set; using local fallback to 127.0.0.1:5432/adl_core");
    } else {
      fail("DATABASE_URL is missing. Provide .env with a valid connection string.");
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch (err: any) {
    fail(`Invalid DATABASE_URL: ${err?.message || "parse_error"}`);
  }

  const user = parsed.username ? decodeURIComponent(parsed.username) : null;
  const password = parsed.password ? decodeURIComponent(parsed.password) : null;
  const host = parsed.hostname || null;
  const port = parsed.port ? Number(parsed.port) : NaN;
  const database = parsed.pathname?.startsWith("/") ? parsed.pathname.slice(1) : parsed.pathname;
  if (!user) fail("DATABASE_URL missing username.");
  if (!password) fail("DATABASE_URL missing password.");
  if (!host) fail("DATABASE_URL missing host.");
  if (!database) fail("DATABASE_URL missing database name.");
  if (!Number.isFinite(port) || port <= 0) fail("DATABASE_URL missing or invalid port.");

  let resolvedHost = host;
  if (["postgres", "db", "base"].includes(resolvedHost) && !process.env.DOCKER_ENV) {
    console.warn(`Postgres host "${resolvedHost}" not resolvable locally, falling back to localhost`);
    resolvedHost = "localhost";
  }

  return { host: resolvedHost, port, user, password, database };
}

export async function getClient(): Promise<Client> {
  if (client) return client;
  const cfg = buildConfig();
  client = new Client(cfg);
  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch (err: any) {
    console.error("Cannot connect to PostgreSQL. Check DATABASE_URL or container network.", { error: err?.message });
    process.exit(1);
  }
  return client;
}

export async function closeClient(): Promise<void> {
  if (client) {
    await client.end().catch(() => {});
    client = null;
  }
}

