import "dotenv/config";
import { parseArgs } from "./cli/parseArgs";
import { PluginRegistry } from "./core/registry";
import { runAnalyst } from "./core/analyst";
import type { AnalystConfig } from "./core/config";
import { runPharmaPlugin } from "./plugins/pharma";

async function bootstrap() {
  const args = parseArgs(process.argv.slice(2));
  const registry = new PluginRegistry();

  registry.register({
    name: "pharma",
    run: runPharmaPlugin
  });

  const config: AnalystConfig = { plugin: args.plugin };
  const exitCode = await runAnalyst(config, registry);
  process.exit(exitCode);
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(4);
});
