import "dotenv/config";
import { closeClient } from "./db";
import { buildPharmaSearchIndex } from "../plugins/pharma";

async function main() {
  try {
    await buildPharmaSearchIndex();
    console.log("pharma search index built");
  } finally {
    await closeClient();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

