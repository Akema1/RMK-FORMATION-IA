import { useState } from "react";
import { Copy, Check, AlertCircle } from "lucide-react";

type CopyState = "idle" | "copied" | "error";

interface CopyableReferenceProps {
  value: string;
  className?: string;
}

export function CopyableReference({ value, className }: CopyableReferenceProps) {
  const [state, setState] = useState<CopyState>("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 ${className ?? ""}`}
    >
      <span
        aria-label="Référence de paiement"
        className="flex-1 font-mono text-lg font-semibold tracking-wider text-slate-900"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copier la référence"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {state === "copied" ? (
          <>
            <Check className="h-4 w-4 text-green-600" aria-hidden />
            <span>Copié !</span>
          </>
        ) : state === "error" ? (
          <>
            <AlertCircle className="h-4 w-4 text-red-600" aria-hidden />
            <span>Échec</span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden />
            <span>Copier</span>
          </>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied"
          ? "Référence copiée"
          : state === "error"
            ? "Échec de la copie"
            : ""}
      </span>
    </div>
  );
}
