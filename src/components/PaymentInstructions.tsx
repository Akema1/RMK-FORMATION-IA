import { CopyableReference } from "./CopyableReference";
import { Building2 } from "lucide-react";

interface PaymentInstructionsProps {
  reference?: string;
  amountFcfa?: number;
  supportPhone: string;
}

const fmtAmount = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

export function PaymentInstructions({
  reference,
  amountFcfa,
  supportPhone,
}: PaymentInstructionsProps) {
  const waNumber = supportPhone.replace(/\D/g, "");

  return (
    <section
      aria-labelledby="payment-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2
        id="payment-heading"
        className="mt-0 text-lg font-semibold text-slate-900"
      >
        Modalités de paiement
      </h2>

      {reference && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-slate-600">Votre référence :</p>
          <CopyableReference value={reference} />
        </div>
      )}

      {amountFcfa != null && (
        <p className="mt-4 text-base text-slate-900">
          <span className="font-semibold">Montant :</span> {fmtAmount(amountFcfa)}
        </p>
      )}

      <ul className="mt-5 flex list-none flex-col gap-3 p-0">
        <PaymentRow
          logo="/wave.svg"
          alt="Wave"
          label="Wave"
          value={supportPhone}
        />
        <PaymentRow
          logo="/orange-money.svg"
          alt="Orange Money"
          label="Orange Money"
          value={supportPhone}
        />
        <PaymentRow
          logo={null}
          alt=""
          label="Virement bancaire"
          value={`Contactez-nous : ${supportPhone}`}
        />
      </ul>

      <div className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-slate-800">
        <span aria-hidden>📞</span>{" "}
        <strong>Question ou virement :</strong>{" "}
        <a
          href={`https://wa.me/${waNumber}`}
          className="font-medium text-blue-700 underline-offset-2 hover:underline"
        >
          {supportPhone}
        </a>{" "}
        (Appel / WhatsApp)
      </div>
    </section>
  );
}

interface PaymentRowProps {
  logo: string | null;
  alt: string;
  label: string;
  value: string;
}

function PaymentRow({ logo, alt, label, value }: PaymentRowProps) {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex w-12 justify-center">
        {logo ? (
          <img src={logo} alt={alt} height={32} className="h-8" />
        ) : (
          <Building2 className="h-7 w-7 text-slate-500" aria-hidden />
        )}
      </div>
      <div className="flex-1 font-semibold text-slate-900">{label}</div>
      <div className="font-mono text-sm text-slate-700">{value}</div>
    </li>
  );
}
