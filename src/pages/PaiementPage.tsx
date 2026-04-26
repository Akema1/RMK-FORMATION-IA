import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PaymentInstructions } from "@/src/components/PaymentInstructions";
import { SUPPORT_PHONE } from "@/src/data/contact";

export function PaiementPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-slate-900">Paiement</h1>
      <p className="mt-2 text-slate-700">
        Si vous êtes déjà inscrit·e, votre référence personnelle vous a été
        envoyée par e-mail. Sinon, contactez-nous pour finaliser votre
        inscription.
      </p>

      <div className="mt-6">
        <PaymentInstructions supportPhone={SUPPORT_PHONE} />
      </div>
    </main>
  );
}

export default PaiementPage;
