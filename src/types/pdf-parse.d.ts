declare module "pdf-parse" {
  export interface PDFInfo {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }
  export interface PDFResult {
    text: string;
    info: PDFInfo;
  }
  function pdf(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PDFResult>;
  export = pdf;
}

