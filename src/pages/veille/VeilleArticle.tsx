import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchArticleBySlug, type VeilleArticle } from '../../lib/veilleApi';
import DiagnosticCTA from './DiagnosticCTA';

const SECTOR = 'banque';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

export default function VeilleArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<VeilleArticle | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!slug) {
      setState('notfound');
      return;
    }
    let active = true;
    fetchArticleBySlug(slug).then((res) => {
      if (!active) return;
      if (res.error) {
        setState('error');
      } else if (!res.data) {
        setState('notfound');
      } else {
        setArticle(res.data);
        setState('ready');
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (state === 'loading') {
    return <main className="mx-auto max-w-3xl px-5 py-16 text-slate-500">Chargement…</main>;
  }

  if (state === 'notfound' || state === 'error') {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-lg font-semibold text-slate-900">
          {state === 'notfound' ? 'Cet article est introuvable.' : 'Article momentanément indisponible.'}
        </p>
        <Link to="/veille" className="mt-4 inline-block font-medium text-slate-900 underline">
          ← Retour à la Veille IA
        </Link>
      </main>
    );
  }

  if (!article) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/veille" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Veille IA · Banque & Finance
      </Link>

      <article className="mt-6">
        <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          {article.title_fr}
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-slate-700">{article.summary_fr}</p>

        {article.so_what?.[SECTOR] && (
          <div className="mt-8 rounded-xl border-l-4 border-slate-900 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Concrètement, pour la banque
            </p>
            <p className="mt-2 text-slate-900">{article.so_what[SECTOR]}</p>
          </div>
        )}

        {article.formation_links.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-700">Pour aller plus loin</p>
            <ul className="mt-2 flex flex-wrap gap-3">
              {article.formation_links.map((f) => (
                <li key={f.url}>
                  <a
                    href={f.url}
                    className="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:border-slate-900"
                  >
                    {f.label} →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-500">
          Source :{' '}
          <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="underline">
            {article.source_name || article.source_url}
          </a>
          . Synthèse RMK Conseils — nous ne reproduisons pas l'article d'origine.
        </p>
      </article>

      <div className="mt-12">
        <DiagnosticCTA />
      </div>
    </main>
  );
}
