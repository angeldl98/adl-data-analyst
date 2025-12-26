"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const parseArgs_1 = require("./cli/parseArgs");
const registry_1 = require("./core/registry");
const analyst_1 = require("./core/analyst");
const config_1 = require("./core/config");
const pharma_1 = require("./plugins/pharma");
const boe_1 = require("./plugins/boe");
async function bootstrap() {
    const args = (0, parseArgs_1.parseArgs)(process.argv.slice(2));
    const registry = new registry_1.PluginRegistry();
    registry.register(pharma_1.PharmaPlugin);
    registry.register(boe_1.BoePlugin);
    const config = { plugin: (0, config_1.validatePluginName)(args.plugin) };
    const exitCode = await (0, analyst_1.runAnalyst)(config, registry);
    process.exit(exitCode);
}
bootstrap().catch(err => {
    console.error(err);
    process.exit(4);
});
