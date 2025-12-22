import type { Client } from "pg";

export type PluginResult = {
  processed: number;
  errors: number;
  notes?: string | null;
};

export type PluginRunContext = {
  client: Client;
  metaSchema: string;
  runId: string;
};

export interface AnalystPlugin {
  name: string;
  run(ctx: PluginRunContext): Promise<PluginResult>;
}
