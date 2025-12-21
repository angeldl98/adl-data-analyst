import { getClient } from "../../db";

export async function runPharmaPlugin(): Promise<{ processed: number; errors: number }> {
  const client = await getClient();
  let processed = 0;
  let errors = 0;
  await client.query("BEGIN");
  try {
    await client.query(
      `
        CREATE TABLE IF NOT EXISTS pharma_prod.search_index (
          raw_id INT PRIMARY KEY,
          nombre TEXT,
          codigo_nacional TEXT,
          laboratorio TEXT,
          estado TEXT,
          presentacion TEXT,
          url TEXT,
          checksum TEXT,
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `
    );
    await client.query("TRUNCATE pharma_prod.search_index");
    const res = await client.query(
      `
        INSERT INTO pharma_prod.search_index (raw_id, nombre, codigo_nacional, laboratorio, estado, presentacion, url, checksum, updated_at)
        SELECT raw_id, nombre, codigo_nacional, laboratorio, estado, presentacion, url, checksum, now()
        FROM pharma_norm.medicamentos
      `
    );
    processed = res.rowCount || 0;
    await client.query("COMMIT");
  } catch (err) {
    errors += 1;
    await client.query("ROLLBACK");
    throw err;
  }
  return { processed, errors };
}

