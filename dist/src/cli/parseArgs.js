"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArgs = parseArgs;
function parseArgs(argv) {
    const pluginArg = argv.find(arg => arg.startsWith("--plugin="));
    const plugin = pluginArg ? pluginArg.split("=", 2)[1] : "pharma";
    return { plugin };
}
