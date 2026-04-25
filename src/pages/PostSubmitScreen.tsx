import { useEffect, useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckCircle2, Download, Home } from "lucide-react";
import { PaymentInstructions } from "@/src/components/PaymentInstructions";
import { SUPPORT_PHONE } from "@/src/data/contact";
import { SEMINARS, getSeminarPricing } from "@/src/data/seminars";

const STORAGE_KEY = "rmk:lastReg";

interface PostSubmitState {
  paymentReference: string;
  participantId?: string;
  seminarId?: string;
}

function readPersisted(): PostSubmitState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PostSubmitState>;
    if (!parsed.paymentReference) return null;
    return {
      paymentReference: parsed.paymentReference,
      participantId: parsed.participantId,
      seminarId: parsed.seminarId,
    };
  } catch {
    return null;
  }
}

export function PostSubmitScreen() {
  const location = useLocation();
  const stateFromNav = (location.state ?? null) as PostSubmitState | null;

  const data = useMemo<PostSubmitState | null>(() => {
    if (stateFromNav?.paymentReference) return stateFromNav;
    return readPersisted();
  }, [stateFromNav]);

  // Persist for refresh resilience whenever fresh data lands via navigation.
  useEffect(() => {
    if (stateFromNav?.paymentReference) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateFromNav));
      } catch {
        // sessionStorage may be unavailable (e.g., privacy mode) — non-fatal.
      }
    }
  }, [stateFromNav]);

  if (!data) return <Navigate to="/" replace />;

  const seminar = data.seminarId
    ? SEMINARS.find((s) => s.id === data.seminarId)
    : undefined;
  const amount = seminar
    ? getSeminarPricing(seminar.id, SEMINARS).standard
    : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-7 w-7 flex-shrink-0 text-green-600" aria-hidden />
          <div>
            <h1 className="m-0 text-2xl font-bold text-slate-900">
              Inscription enregistrée
            </h1>
            <p className="mt-2 text-slate-700">
              Merci ! Conservez votre référence ci-dessous pour finaliser votre
              paiement.
            </p>
          </div>
        </div>
      </div>

      {seminar && (
        <p className="mt-6 text-sm text-slate-600">
          Séminaire :{" "}
          <span className="font-semibold text-slate-900">{seminar.title}</span>{" "}
          ({seminar.week})
        </p>
      )}

      <div className="mt-6">
        <PaymentInstructions
          reference={data.paymentReference}
          amountFcfa={amount}
          supportPhone={SUPPORT_PHONE}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/brochure.pdf"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          Télécharger la brochure
        </a>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <Home className="h-4 w-4" aria-hidden />
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}

export default PostSubmitScreen;
