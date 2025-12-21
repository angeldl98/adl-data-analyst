import "dotenv/config";
import { closeClient, getClient } from "./db";
import { runPharmaPlugin } from "./plugins/pharma";

async function main() {
  const plugin = process.argv.find(arg => arg.startsWith("--plugin="))?.split("=")[1] || "pharma";
  const startedAt = new Date().toISOString();
  let processed = 0;
  let errors = 0;
  try {
    if (plugin === "pharma") {
      const r = await runPharmaPlugin();
      processed = r.processed;
      errors = r.errors;
    } else {
      throw new Error(`unknown_plugin_${plugin}`);
    }
    console.log("analyst run ok", { plugin, processed, errors, startedAt });
  } catch (err: any) {
    console.error("analyst run failed", { plugin, error: err?.message });
    throw err;
  } finally {
    await closeClient();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

