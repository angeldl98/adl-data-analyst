export type Opportunity = {
  subasta_id: number;
  provincia: string | null;
  municipio: string | null;
  precio: number;
  valor: number;
  discount_pct: number;
  deadline: Date | null;
  url: string | null;
  tipo_bien: string | null;
  descripcion_bien: string | null;
  semaforo?: string;
  criterio_usado?: string;
};

export type ReportContext = {
  province: string;
  periodStart: Date;
  periodEnd: Date;
  topN: number;
  minDiscount: number;
  runId: string;
  criterio: string;
};

export type Subscriber = {
  email: string;
  province: string | null;
};

