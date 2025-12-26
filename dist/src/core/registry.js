"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginRegistry = void 0;
/**
 * Registry of analyst plugins. Each vertical must implement the AnalystPlugin contract
 * (name, version, metaSchema, materialize). All plugins are registered explicitly at
 * startup; no dynamic imports or magic discovery are allowed.
 */
class PluginRegistry {
    constructor() {
        this.plugins = new Map();
    }
    register(plugin) {
        this.plugins.set(plugin.name, plugin);
    }
    get(name) {
        return this.plugins.get(name);
    }
}
exports.PluginRegistry = PluginRegistry;
