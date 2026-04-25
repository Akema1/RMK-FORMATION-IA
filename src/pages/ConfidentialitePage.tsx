import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SUPPORT_EMAIL } from "@/src/data/contact";

export function ConfidentialitePage() {
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
        Politique de confidentialité
      </h1>

      <div className="prose prose-slate mt-6 max-w-none text-slate-700">
        <p>
          Les données personnelles collectées sur ce site (nom, e-mail,
          téléphone, fonction, société) sont utilisées exclusivement pour
          traiter votre inscription au séminaire et vous tenir informé·e des
          étapes de paiement et de logistique.
        </p>
        <p>
          Conformément à la réglementation applicable, vous disposez d'un droit
          d'accès, de rectification et de suppression de vos données. Pour
          exercer ces droits, écrivez à{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-blue-700 underline-offset-2 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p>
          Le contenu détaillé de cette politique sera publié prochainement par
          RMK Conseils.
        </p>
      </div>
    </main>
  );
}

export default ConfidentialitePage;
