import { PluginRegistry } from "./registry";
import type { AnalystConfig } from "./config";
import { logError, logInfo } from "./observability";
import type { AnalystPlugin } from "./plugin";

export async function runAnalyst(config: AnalystConfig, registry: PluginRegistry): Promise<number> {
  const plugin: AnalystPlugin | undefined = registry.get(config.plugin);
  if (!plugin) {
    logError("analyst_run_error", { plugin: config.plugin, error: "unknown_plugin" });
    return 2; // exit code 2 for unknown plugin / bad args
  }

  try {
    logInfo("analyst_run_start", { plugin: plugin.name });
    await plugin.run();
    logInfo("analyst_run_end", { plugin: plugin.name, status: "ok" });
    return 0;
  } catch (err: any) {
    logError("analyst_run_error", { plugin: plugin.name, error: err?.message });
    return 4; // generic failure (locks/runs not yet implemented)
  }
}
