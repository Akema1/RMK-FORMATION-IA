import { Resend } from "resend";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailConfig {
  resendApiKey: string;
  from: string;
}

export async function sendEmail(
  input: SendEmailInput,
  cfg: SendEmailConfig,
): Promise<void> {
  if (!cfg.resendApiKey) {
    console.warn(
      "[sendEmail] RESEND_API_KEY missing — skipping send to",
      input.to,
    );
    return;
  }
  const resend = new Resend(cfg.resendApiKey);
  const { error } = await resend.emails.send({
    from: cfg.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) throw new Error(error.message ?? "Resend send failed");
}
