import { useState, type FormEvent } from 'react';
import { bookDiagnostic } from '../../lib/veilleApi';

type FormState = 'idle' | 'loading' | 'done' | 'error';

export default function DiagnosticCTA() {
  const [nom, setNom] = useState('');
  const [contact, setContact] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    setError('');
    const res = await bookDiagnostic({
      nom,
      contact,
      entreprise: entreprise.trim() || undefined,
      notes: 'Demande de diagnostic IA depuis la Veille IA (banque/finance).',
    });
    if (res.success) {
      setState('done');
    } else {
      setState('error');
      setError(res.error ?? 'Une erreur est survenue. Réessayez.');
    }
  }

  return (
    <section className="rounded-2xl bg-slate-900 p-8 text-white">
      <h3 className="text-2xl font-bold">Diagnostic IA gratuit (30 min)</h3>
      <p className="mt-2 max-w-2xl text-slate-300">
        Un échange avec l'équipe RMK pour identifier les deux ou trois usages de l'IA qui
        comptent vraiment pour votre établissement. Sans engagement.
      </p>

      {state === 'done' ? (
        <div className="mt-6 rounded-xl bg-white/10 p-5">
          <p className="text-lg font-semibold">Merci, c'est enregistré.</p>
          <p className="mt-1 text-sm text-slate-300">
            L'équipe RMK vous recontacte sous 24h pour caler le créneau.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 grid gap-3 sm:grid-cols-3" noValidate>
          <input
            type="text"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom et prénom"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
          />
          <input
            type="text"
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email ou téléphone"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
          />
          <input
            type="text"
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            placeholder="Établissement (optionnel)"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
          />
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={state === 'loading'}
              className="rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {state === 'loading' ? 'Envoi…' : 'Réserver mon diagnostic'}
            </button>
            {state === 'error' && (
              <p className="mt-2 text-sm text-red-300" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
