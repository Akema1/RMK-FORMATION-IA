import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SUPPORT_EMAIL } from "@/src/data/contact";

export function CguPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-slate-900">
        Conditions générales d'utilisation
      </h1>

      <div className="prose prose-slate mt-6 max-w-none text-slate-700">
        <p>
          Le contenu officiel des conditions générales d'utilisation est en
          cours de rédaction par RMK Conseils. Les inscriptions effectuées sur
          ce site sont régies, dans l'intervalle, par les conditions
          contractuelles transmises avec votre confirmation d'inscription.
        </p>
        <p>
          Pour toute question, contactez-nous à{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-blue-700 underline-offset-2 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  );
}

export default CguPage;
