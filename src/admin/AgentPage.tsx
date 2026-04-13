import React, { useState } from 'react';
import { callAI } from './callAI';
import { card, selectS, btnPrimary, label, ORANGE, ICON_EMOJI } from './config';
import type { Seminar, AgentHistoryEntry } from './types';

interface AgentPageProps {
  seminars: Seminar[];
}

export function AgentPage({ seminars }: AgentPageProps) {
  const [seminar, setSeminar] = useState(seminars[0]?.id || "s1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [history, setHistory] = useState<AgentHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('rmk_agent_history') || '[]'); } catch { return []; }
  });

  const runAgent = async () => {
    const s = seminars.find(x => x.id === seminar);
    if (!s) return;
    setLoading(true);
    setResult("");
    try {
      // Server-side "commercial" template (api/prompts.ts) renders the full
      // system prompt from a trusted whitelist + injects live seminar stats.
      // Client only supplies the seminarId and a free-form user request.
      const userPrompt = `Génère le plan de prospection du jour pour le séminaire ${s.code} - ${s.title}. Concentre-toi sur les entreprises les plus susceptibles d'inscrire leurs cadres. Sois concret avec des noms d'entreprises réelles d'Abidjan et de Côte d'Ivoire.`;

      const res = await callAI('commercial', {
        vars: { seminarId: s.id },
        userPrompt,
      });
      setResult(res.text);
      const newHistory: AgentHistoryEntry[] = [{ date: new Date().toLocaleString("fr-FR"), seminar: s.code, title: s.title, result: res.text }, ...history.slice(0, 9)];
      setHistory(newHistory);
      localStorage.setItem('rmk_agent_history', JSON.stringify(newHistory));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setResult(`Erreur: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Agent Commercial IA</h2>
      <p style={{ color: '#1B2A4A', fontSize: 14, margin: "0 0 24px" }}>Prospection automatisée : identification des meilleurs profils d'apprenants, scripts de vente et plans de contact personnalisés par séminaire.</p>

      <div style={{ ...card, marginBottom: 24, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={label}>Séminaire cible</label>
          <select style={selectS} value={seminar} onChange={e => setSeminar(e.target.value)}>
            {seminars.map(s => <option key={s.id} value={s.id}>{ICON_EMOJI[s.icon] || "📋"} {s.code} – {s.title}</option>)}
          </select>
        </div>
        <button onClick={runAgent} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, minWidth: 220 }}>
          {loading ? "Analyse en cours..." : "Lancer la prospection du jour"}
        </button>
      </div>

      {result && (
        <div style={{ ...card, marginBottom: 24, borderLeft: `3px solid ${ORANGE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, margin: 0 }}>Plan de prospection – {seminars.find(x => x.id === seminar)?.code}</h3>
            <span style={{ fontSize: 11, color: '#1B2A4A' }}>{new Date().toLocaleString("fr-FR")}</span>
          </div>
          <div style={{ color: '#1B2A4A', fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result}</div>
        </div>
      )}

      {history.length > 0 && (
        <>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Historique des recherches</h3>
          {history.map((h, i) => (
            <details key={i} style={{ ...card, marginBottom: 8, cursor: "pointer" }}>
              <summary style={{ color: "#1B2A4A", fontSize: 13, fontWeight: 600 }}>{h.date} – {h.seminar} {h.title}</summary>
              <div style={{ color: '#1B2A4A', fontSize: 13, lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" }}>{h.result}</div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
