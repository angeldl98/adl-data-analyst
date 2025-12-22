export type ParsedArgs = {
  plugin: string;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const pluginArg = argv.find(arg => arg.startsWith("--plugin="));
  const plugin = pluginArg ? pluginArg.split("=", 2)[1] : "pharma";
  return { plugin };
}
