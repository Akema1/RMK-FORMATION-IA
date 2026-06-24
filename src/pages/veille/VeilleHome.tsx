import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublishedArticles, type VeilleArticle } from '../../lib/veilleApi';
import SubscribeForm from './SubscribeForm';
import DiagnosticCTA from './DiagnosticCTA';

// Slice 1 beachhead: a single sector. Banque/finance per the design doc.
const SECTOR = 'banque';
const SECTOR_LABEL = 'Banque & Finance';

type LoadState = 'loading' | 'ready' | 'error';

export default function VeilleHome() {
  const [articles, setArticles] = useState<VeilleArticle[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    fetchPublishedArticles(SECTOR).then((res) => {
      if (!active) return;
      if (res.error) {
        setState('error');
      } else {
        setArticles(res.data);
        setState('ready');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <header className="border-b border-slate-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Veille IA · {SECTOR_LABEL} · Afrique de l'Ouest
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
          Ce que l'IA change pour les dirigeants, ici.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          L'actualité mondiale de l'IA, l'automation, la robotique et les drones, filtrée
          et traduite en « concrètement, pour mon secteur, qu'est-ce que ça change ».
        </p>
        <div className="mt-8">
          <SubscribeForm sector={SECTOR} sectorLabel={SECTOR_LABEL} />
        </div>
      </header>

      <section className="py-10">
        {state === 'loading' && (
          <p className="text-slate-500">Chargement des derniers décryptages…</p>
        )}

        {state === 'error' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
            <p className="font-semibold">Le flux est momentanément indisponible.</p>
            <p className="text-sm">Réessayez dans un instant. En attendant, abonnez-vous au brief ci-dessus.</p>
          </div>
        )}

        {state === 'ready' && articles.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-lg font-semibold text-slate-800">Le premier numéro arrive.</p>
            <p className="mt-1 text-slate-600">
              Abonnez-vous ci-dessus pour recevoir le tout premier brief « {SECTOR_LABEL} × IA ».
            </p>
          </div>
        )}

        {state === 'ready' && articles.length > 0 && (
          <ul className="flex flex-col gap-6">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/veille/${a.slug}`}
                  className="group block rounded-xl border border-slate-200 p-6 transition hover:border-slate-900 hover:shadow-sm"
                >
                  <h2 className="text-xl font-bold text-slate-900 group-hover:underline">
                    {a.title_fr}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-slate-600">{a.summary_fr}</p>
                  {a.so_what?.[SECTOR] && (
                    <p className="mt-3 text-sm font-medium text-slate-900">
                      <span className="text-slate-500">Pour vous : </span>
                      {a.so_what[SECTOR]}
                    </p>
                  )}
                  {a.source_name && (
                    <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                      Source : {a.source_name}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="py-6">
        <DiagnosticCTA />
      </div>
    </main>
  );
}
