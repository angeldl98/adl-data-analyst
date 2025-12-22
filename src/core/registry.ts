import type { AnalystPlugin } from "./plugin";

export class PluginRegistry {
  private plugins: Map<string, AnalystPlugin> = new Map();

  register(plugin: AnalystPlugin) {
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): AnalystPlugin | undefined {
    return this.plugins.get(name);
  }
}
