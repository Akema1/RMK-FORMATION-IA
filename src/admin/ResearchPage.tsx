import React, { useState } from 'react';
import { callGemini } from './callGemini';
import { card, inputS, btnPrimary, btnSecondary, label } from './config';
import type { Seminar, AgentHistoryEntry } from './types';

interface ResearchPageProps {
  seminars: Seminar[];
}

const presets = [
  { cat: "avion", label: "Vol Paris → Abidjan", query: "prix billet avion aller-retour Paris Abidjan mai 2026 compagnies aériennes" },
  { cat: "avion", label: "Vol Ndjamena → Abidjan", query: "prix billet avion aller-retour Ndjamena Abidjan mai 2026" },
  { cat: "salle", label: "Salle de conférence Abidjan", query: "prix location salle de conférence séminaire 20-25 personnes Abidjan Plateau Cocody 2026" },
  { cat: "traiteur", label: "Traiteur Abidjan", query: "prix traiteur pause café déjeuner séminaire professionnel 20 personnes Abidjan" },
  { cat: "hotel", label: "Hôtel formateur", query: "prix hôtel business Abidjan Plateau Cocody 4 nuits mai 2026" },
  { cat: "zoom", label: "Zoom Pro", query: "prix abonnement Zoom Pro mensuel fonctionnalités webinaire 2026" },
];

export function ResearchPage({ seminars }: ResearchPageProps) {
  const [query, setQuery] = useState("prix billet avion Paris Abidjan mai 2026");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [history, setHistory] = useState<AgentHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('rmk_research_history') || '[]'); } catch { return []; }
  });

  const runResearch = async (q = query) => {
    setLoading(true);
    setResult("");
    const systemPrompt = `Tu es un assistant de recherche pour RMK, société qui organise des séminaires de formation IA à Abidjan en mai 2026. Tu dois fournir des estimations de prix détaillées et réalistes basées sur le marché ivoirien/ouest-africain.

Pour chaque recherche, fournis:
1. FOURCHETTE DE PRIX en FCFA (minimum – moyen – maximum)
2. Les prestataires recommandés avec noms et contacts si possible
3. Conseils de négociation
4. Alternatives économiques
5. Timing de réservation optimal
6. Conditions et inclusions typiques

Sois très concret et adapté au contexte d'Abidjan, Côte d'Ivoire. Utilise les prix réels du marché local. Monnaie: FCFA (XOF).`;

    const res = await callGemini(systemPrompt, q, seminars, true);
    setResult(res.text);
    const newHistory: AgentHistoryEntry[] = [{ date: new Date().toLocaleString("fr-FR"), query: q, result: res.text }, ...history.slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('rmk_research_history', JSON.stringify(newHistory));
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Agent Recherche & Estimations</h2>
      <p style={{ color: '#1B2A4A', fontSize: 14, margin: "0 0 24px" }}>Recherche de prix en temps réel : billets d'avion, salles, traiteurs, hôtels et tout ce dont vous avez besoin pour le budget.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {presets.map((p, i) => (
          <button key={i} onClick={() => { setQuery(p.query); runResearch(p.query); }} style={{ ...btnSecondary, fontSize: 12 }}>{p.label}</button>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 24, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <label style={label}>Recherche personnalisée</label>
          <input style={inputS} value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex: prix location salle 25 personnes Abidjan..." onKeyDown={e => e.key === "Enter" && runResearch()} />
        </div>
        <button onClick={() => runResearch()} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, minWidth: 200 }}>
          {loading ? "Recherche..." : "Rechercher & Estimer"}
        </button>
      </div>

      {result && (
        <div style={{ ...card, marginBottom: 24, borderLeft: "3px solid #2980B9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, margin: 0 }}>Résultats de recherche</h3>
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
              <summary style={{ color: "#1B2A4A", fontSize: 13, fontWeight: 600 }}>{h.date} – {(h.query || "").slice(0, 60)}...</summary>
              <div style={{ color: '#1B2A4A', fontSize: 13, lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" }}>{h.result}</div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
