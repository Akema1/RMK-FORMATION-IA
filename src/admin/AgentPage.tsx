import React, { useState } from 'react';
import { COMMERCIAL_STRATEGY } from '../lib/strategy';
import { callGemini } from './callGemini';
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
    const systemPrompt = `Tu es un agent commercial expert pour RMK Conseils, société qui organise des séminaires de formation en Intelligence Artificielle à Abidjan, Côte d'Ivoire. La formation est délivrée par CABEXIA, Cabinet d'Expertise en IA.

Voici la stratégie commerciale globale de l'événement :
${COMMERCIAL_STRATEGY}

Tu dois identifier les MEILLEURS profils de participants potentiels pour le séminaire "${s.title}" (${s.week}).

Contexte marché Abidjan:
- 1ère place financière UEMOA (BRVM, BCEAO)
- 28 banques commerciales, nombreuses SGI et assurances
- 500+ grandes entreprises et multinationales
- Écosystème tech en croissance +15% annuel
- Mobile money: Orange Money, MTN MoMo, Wave

Profils cibles: ${s.targets.join(", ")}
Secteurs prioritaires: ${s.sectors.join(", ")}
Prix: 600 000 FCFA (5 jours hybride: 3 présentiel + 2 en ligne)
Places: ${s.seats} maximum

Réponds en français. Fournis un plan de prospection journalier avec:
1. TOP 10 entreprises/institutions à contacter en priorité à Abidjan (noms réels)
2. Les profils décideurs clés dans chaque entreprise (titres de poste)
3. Argumentaire de vente adapté au secteur
4. Script d'approche LinkedIn (message InMail)
5. Script WhatsApp de premier contact
6. Objections probables et réponses
7. Canaux de contact recommandés par cible`;

    const userPrompt = `Génère le plan de prospection du jour pour le séminaire ${s.code} - ${s.title}. Concentre-toi sur les entreprises les plus susceptibles d'inscrire leurs cadres. Sois concret avec des noms d'entreprises réelles d'Abidjan et de Côte d'Ivoire.`;

    const tools = [{
      name: "check_seminar_stats",
      description: "Récupère les statistiques réelles d'inscription pour un séminaire donné",
      parameters: {
        type: "object",
        properties: { seminarCode: { type: "string", description: "Le code du séminaire: S1, S2, S3 ou S4" } },
        required: ["seminarCode"]
      }
    }];

    const res = await callGemini(systemPrompt, userPrompt, seminars, true, tools);
    setResult(res.text);
    const newHistory: AgentHistoryEntry[] = [{ date: new Date().toLocaleString("fr-FR"), seminar: s.code, title: s.title, result: res.text }, ...history.slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('rmk_agent_history', JSON.stringify(newHistory));
    setLoading(false);
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
