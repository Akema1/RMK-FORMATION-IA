import React, { useState } from 'react';
import { callAI } from './callAI';
import { card, inputS, btnPrimary } from './config';
import type { Seminar, AgentHistoryEntry } from './types';

interface SeoAgentPageProps {
  seminars: Seminar[];
}

export function SeoAgentPage({ seminars: _seminars }: SeoAgentPageProps) {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<AgentHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('rmk_seo_history') || '[]'); } catch { return []; }
  });

  const generateSEO = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      // Server-side template "seo" enforces the system prompt; we send only
      // the topic-specific user request.
      const userPrompt = `Sujet à analyser : "${topic}".
Génère une stratégie SEO complète :
1. 5 mots-clés principaux (avec volume estimé et difficulté)
2. 3 idées de titres d'articles de blog accrocheurs
3. Une meta description optimisée (max 160 caractères)
4. Un plan de contenu (H1, H2, H3) pour une page d'atterrissage`;

      const res = await callAI('seo', { userPrompt });
      setResult(res.text);
      const newHistory: AgentHistoryEntry[] = [{ date: new Date().toLocaleString("fr-FR"), topic, result: res.text }, ...history.slice(0, 9)];
      setHistory(newHistory);
      localStorage.setItem('rmk_seo_history', JSON.stringify(newHistory));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setResult(`Erreur: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 24px" }}>Agent SEO & Contenu</h2>
      <div style={{ ...card, marginBottom: 24 }}>
        <p style={{ color: '#1B2A4A', fontSize: 14, marginBottom: 16 }}>L'Agent SEO vous aide à générer des mots-clés, des idées d'articles et des structures de pages pour attirer plus de prospects organiques sur vos séminaires.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <input style={{ ...inputS, flex: 1 }} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Formation IA pour les Directeurs Financiers à Abidjan" />
          <button onClick={generateSEO} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Génération..." : "Générer Stratégie SEO"}
          </button>
        </div>
      </div>
      {result && (
        <div style={{ ...card, background: "rgba(0,0,0,0.02)", marginBottom: 24 }}>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Résultat SEO</h3>
          <div style={{ color: "#1B2A4A", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{result}</div>
        </div>
      )}
      {history.length > 0 && (
        <>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Historique SEO</h3>
          {history.map((h, i) => (
            <details key={i} style={{ ...card, marginBottom: 8, cursor: "pointer" }}>
              <summary style={{ color: "#1B2A4A", fontSize: 13, fontWeight: 600 }}>{h.date} – {h.topic}</summary>
              <div style={{ color: '#1B2A4A', fontSize: 13, lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" }}>{h.result}</div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
