declare module "unzipper" {
  export const Open: {
    file(path: string): Promise<{ files: Array<{ path: string; type: "File" | "Directory"; buffer(): Promise<Buffer> }> }>;
  };
}

