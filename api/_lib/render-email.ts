import { layout } from "../_email-templates/_layout.js";

/**
 * Contract for an email template.
 *
 * **HTML escape contract:** the `html` function returns a fully-escaped
 * HTML body — every prop value interpolated into the markup MUST be passed
 * through `escapeHtml` from `_layout.ts`. The renderer does NOT escape
 * automatically; pre-rendered fragments (formatted prices, anchor tags
 * with text) would double-escape. Forgetting to escape opens stored XSS
 * in the email client.
 *
 * `subject` and `text` are plain text — no escaping needed by the template,
 * the renderer/layout escapes the title.
 *
 * `subject(props)` should be pure (deterministic for given props) — the
 * renderer calls it once and reuses the value for both the subject line
 * and the HTML <title>.
 */
export interface EmailTemplate<TProps> {
  subject: (props: TProps) => string;
  html: (props: TProps) => string;
  text: (props: TProps) => string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail<TProps>(
  template: EmailTemplate<TProps>,
  props: TProps,
): RenderedEmail {
  const subject = template.subject(props);
  return {
    subject,
    html: layout({
      title: subject,
      bodyHtml: template.html(props),
    }),
    text: template.text(props),
  };
}
