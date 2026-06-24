import { useState, type FormEvent } from 'react';
import { subscribeToVeille } from '../../lib/veilleApi';

interface SubscribeFormProps {
  sector: string;
  sectorLabel: string;
}

type FormState = 'idle' | 'loading' | 'done' | 'error';

export default function SubscribeForm({ sector, sectorLabel }: SubscribeFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    setError('');
    const res = await subscribeToVeille({
      email,
      role: role.trim() || undefined,
      sectors: [sector],
      source_utm: `veille-${sector}`,
    });
    if (res.success) {
      setState('done');
    } else {
      setState('error');
      setError(res.error ?? 'Une erreur est survenue. Réessayez.');
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900">
        <p className="text-lg font-semibold">C'est noté.</p>
        <p className="mt-1 text-sm">
          Vous recevrez le prochain brief « {sectorLabel} × IA » dans votre boîte mail.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label className="text-sm font-medium text-slate-700" htmlFor="veille-email">
        Recevez le brief hebdo « {sectorLabel} × IA »
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="veille-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre.email@entreprise.ci"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-900 focus:outline-none"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Votre fonction (optionnel)"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-900 focus:outline-none sm:max-w-[40%]"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="shrink-0 rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {state === 'loading' ? 'Envoi…' : "S'abonner"}
        </button>
      </div>
      {state === 'error' && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Gratuit. Désabonnement en un clic. Pas de spam.
      </p>
    </form>
  );
}
