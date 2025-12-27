export type Opportunity = {
  subasta_id: number;
  provincia: string | null;
  municipio: string | null;
  precio: number;
  valor: number;
  discount_pct: number;
  deadline: Date | null;
  url: string | null;
};

export type ReportContext = {
  province: string;
  periodStart: Date;
  periodEnd: Date;
  topN: number;
  minDiscount: number;
  runId: string;
};

export type Subscriber = {
  email: string;
  province: string | null;
};

