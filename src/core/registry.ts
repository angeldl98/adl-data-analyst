import type { AnalystPlugin } from "./plugin";

/**
 * Registry of analyst plugins. Each vertical must implement the AnalystPlugin contract
 * (name, version, metaSchema, materialize). All plugins are registered explicitly at
 * startup; no dynamic imports or magic discovery are allowed.
 */
export class PluginRegistry {
  private plugins: Map<string, AnalystPlugin> = new Map();

  register(plugin: AnalystPlugin) {
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): AnalystPlugin | undefined {
    return this.plugins.get(name);
  }
}
