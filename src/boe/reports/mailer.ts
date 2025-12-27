import nodemailer from "nodemailer";
import type { Subscriber } from "./types";

export type MailConfig = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  dryRun: boolean;
};

export async function sendReportEmail(
  cfg: MailConfig,
  subs: Subscriber[],
  subject: string,
  text: string,
  attachmentPath: string
): Promise<void> {
  if (cfg.dryRun || subs.length === 0) return;
  if (!cfg.host || !cfg.port || !cfg.user || !cfg.pass || !cfg.from) {
    console.warn("MAILER_SKIP missing SMTP config");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass }
  });

  await transporter.sendMail({
    from: cfg.from,
    to: subs.map((s) => s.email).join(","),
    subject,
    text,
    attachments: [{ filename: attachmentPath.split("/").pop() || "reporte.pdf", path: attachmentPath }]
  });
}

