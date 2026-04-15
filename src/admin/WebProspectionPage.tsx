import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { callAI } from './callAI';
import { card, inputS, selectS, btnPrimary, btnSecondary, label, ORANGE } from './config';
import type { Seminar, Lead } from './types';

interface WebProspectionPageProps {
  seminars: Seminar[];
  leads: Lead[];
  refreshLeads: () => Promise<void>;
}

const NAVY = '#1B2A4A';

const PRESETS = [
  { label: 'Banques CI', sector: 'Banque & Finance', zone: "Cote d'Ivoire", need: 'Formation IA pour analyse financiere et gestion des risques' },
  { label: 'Telecoms CI', sector: 'Telecommunications', zone: "Cote d'Ivoire", need: 'Automation IA pour service client et analyse donnees' },
  { label: 'Multinationales Abidjan', sector: 'Multinationales', zone: 'Abidjan', need: 'Formation IA pour cadres dirigeants et managers' },
  { label: 'ONG & Institutions', sector: 'ONG / Institutions internationales', zone: 'Afrique de l\'Ouest', need: 'IA pour optimisation des operations et reporting' },
  { label: 'Secteur Public', sector: 'Administration publique', zone: "Cote d'Ivoire", need: 'Modernisation et transformation digitale par l\'IA' },
  { label: 'Cabinets Conseil', sector: 'Conseil & Audit', zone: 'Abidjan', need: 'IA pour audit, analyse et conseil strategique' },
];

interface ProspectResult {
  nom: string;
  secteur: string;
  taille: string;
  besoin: string;
  decideur: string;
  score: string;
  message: string;
}

export function WebProspectionPage({ seminars, leads, refreshLeads }: WebProspectionPageProps) {
  const [sector, setSector] = useState('Banque & Finance');
  const [zone, setZone] = useState("Cote d'Ivoire");
  const [need, setNeed] = useState('Formation et conseil en Intelligence Artificielle');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [addedToLeads, setAddedToLeads] = useState<Set<string>>(new Set());

  const runProspection = async (presetSector?: string, presetZone?: string, presetNeed?: string) => {
    const s = presetSector || sector;
    const z = presetZone || zone;
    const n = presetNeed || need;
    setLoading(true);
    setResult('');

    try {
      // Qwen plan-review fix: upstream passed the `seminars` array to the
      // LLM for grounding. We project it to {code,title,week}[] so the
      // template can cite RMK catalog entries in prospect messages without
      // leaking pricing internals.
      const seminarsContext = seminars.map((sem) => ({
        code: sem.code,
        title: sem.title,
        week: sem.week,
      }));
      const res = await callAI('prospection', {
        vars: { sector: s, zone: z, need: n, seminarsContext },
      });
      setResult(res.text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult(`Erreur: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (p: typeof PRESETS[0]) => {
    setSector(p.sector);
    setZone(p.zone);
    setNeed(p.need);
    runProspection(p.sector, p.zone, p.need);
  };

  // Try to parse JSON prospects from result
  let prospects: ProspectResult[] = [];
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) prospects = JSON.parse(jsonMatch[0]);
  } catch { /* AI didn't return valid JSON, show raw text */ }

  const addToLeads = async (p: ProspectResult) => {
    const { error } = await supabase.from('leads').insert([{
      nom: p.nom,
      source: 'Prospection IA',
      status: 'froid',
      notes: `Secteur: ${p.secteur} | Taille: ${p.taille} | Besoin: ${p.besoin} | Decideur: ${p.decideur} | Score: ${p.score}`,
      contact: '',
    }]);
    if (!error) {
      setAddedToLeads(prev => new Set([...prev, p.nom]));
      refreshLeads();
    }
  };

  return (
    <div>
      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => applyPreset(p)} style={{ ...btnSecondary, fontSize: 12, borderColor: `${ORANGE}44`, color: ORANGE }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom search */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h3 style={{ color: NAVY, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recherche personnalisee</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><label style={label}>Secteur cible</label><input style={inputS} value={sector} onChange={e => setSector(e.target.value)} /></div>
          <div><label style={label}>Zone geographique</label><input style={inputS} value={zone} onChange={e => setZone(e.target.value)} /></div>
          <div><label style={label}>Type de besoin</label><input style={inputS} value={need} onChange={e => setNeed(e.target.value)} /></div>
        </div>
        <button onClick={() => runProspection()} disabled={loading} style={{ ...btnPrimary, marginTop: 12, opacity: loading ? 0.6 : 1 }}>
          {loading ? '🔍 Recherche en cours...' : '🌐 Lancer la prospection'}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ ...card, textAlign: 'center', padding: 40, color: '#94A3B8' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
          L'agent parcourt le web pour identifier les meilleurs prospects...
        </div>
      )}

      {prospects.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: NAVY, fontSize: 16, fontWeight: 700, margin: 0 }}>
              {prospects.length} prospects identifies
            </h3>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{new Date().toLocaleString('fr-FR')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {prospects.map((p, i) => {
              const isAdded = addedToLeads.has(p.nom);
              return (
                <div key={i} style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', background: isAdded ? 'rgba(39,174,96,0.04)' : 'rgba(0,0,0,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{p.nom}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{p.secteur} · {p.taille}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                        background: p.score === 'Elevee' ? 'rgba(39,174,96,0.1)' : p.score === 'Moyenne' ? 'rgba(243,156,18,0.1)' : 'rgba(0,0,0,0.05)',
                        color: p.score === 'Elevee' ? '#27AE60' : p.score === 'Moyenne' ? '#F39C12' : '#94A3B8',
                      }}>{p.score}</span>
                      {isAdded ? (
                        <span style={{ fontSize: 12, color: '#27AE60', fontWeight: 600 }}>✓ Ajoute</span>
                      ) : (
                        <button onClick={() => addToLeads(p)} style={{ ...btnSecondary, fontSize: 11, padding: '4px 12px', borderColor: '#27AE60', color: '#27AE60' }}>
                          + CRM
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: NAVY, marginBottom: 4 }}>
                    <strong>Besoin :</strong> {p.besoin}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                    <strong>Decideur :</strong> {p.decideur}
                  </div>
                  <div style={{ fontSize: 12, color: ORANGE, fontStyle: 'italic' }}>
                    "{p.message}"
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw text fallback */}
      {result && prospects.length === 0 && !loading && (
        <div style={{ ...card, borderLeft: `3px solid ${ORANGE}` }}>
          <h3 style={{ color: NAVY, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Resultats</h3>
          <div style={{ color: NAVY, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result}</div>
        </div>
      )}
    </div>
  );
}
