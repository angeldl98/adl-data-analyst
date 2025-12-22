export type PluginResult = {
  processed: number;
  errors: number;
};

export interface AnalystPlugin {
  name: string;
  run(): Promise<PluginResult>;
}
