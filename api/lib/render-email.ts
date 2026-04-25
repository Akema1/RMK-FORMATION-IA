import { layout } from "../email-templates/_layout.js";

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
  return {
    subject: template.subject(props),
    html: layout({
      title: template.subject(props),
      bodyHtml: template.html(props),
    }),
    text: template.text(props),
  };
}
