// ─────────────────────────────────────────────
// PORTAL COACHING — AI coaching session form + results
// ─────────────────────────────────────────────
import React from 'react';
import { NAVY, GOLD, GOLD_DARK, WHITE, GREEN, cardBase } from './tokens';
import { fmt, COACHING_PRICE } from '../../data/seminars';
import type { Seminar } from '../../data/seminars';
import type { Participant } from '../../admin/types';
import { requestCoaching } from '../../lib/coachingApi';

interface CoachingForm {
  entreprise: string;
  secteur: string;
  role: string;
  defi: string;
  objectif: string;
}

export interface PortalCoachingProps {
  participant: Participant;
  seminar: Seminar | null | undefined;
  coachingForm: CoachingForm;
  setCoachingForm: React.Dispatch<React.SetStateAction<CoachingForm>>;
  coachingResult: string;
  setCoachingResult: React.Dispatch<React.SetStateAction<string>>;
  coachingLoading: boolean;
  setCoachingLoading: React.Dispatch<React.SetStateAction<boolean>>;
  coachingSubmitted: boolean;
  setCoachingSubmitted: React.Dispatch<React.SetStateAction<boolean>>;
}

const OBJECTIFS = [
  'Integration IA dans mon activite',
  'Automatisation de processus internes',
  'Amelioration de la prise de decision',
  'Transformation digitale de mon equipe',
  'Developpement d\'un produit IA',
  'Optimisation de ma relation client',
];

export default function PortalCoaching({
  participant, seminar,
  coachingForm, setCoachingForm,
  coachingResult, setCoachingResult,
  coachingLoading, setCoachingLoading,
  coachingSubmitted, setCoachingSubmitted,
}: PortalCoachingProps) {
  const isS1 = seminar?.code === 'S1' || seminar?.id === 's1';

  if (participant.status !== 'confirmed') {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Coaching IA</h1>
          <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 15 }}>Sessions privees d'accompagnement individuel.</p>
        </div>
        <div style={{ ...cardBase, padding: 48, textAlign: 'center', background: 'linear-gradient(135deg, rgba(27,42,74,0.03), rgba(201,168,76,0.04))', border: '2px dashed rgba(201,168,76,0.3)' }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>&#x1F512;</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 12 }}>Coaching disponible apres confirmation</h2>
          <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 15, lineHeight: 1.7, maxWidth: 440, margin: '0 auto' }}>
            Votre espace de coaching sera accessible des que votre paiement sera valide.
          </p>
        </div>
      </div>
    );
  }

  const handleCoachingAnalysis = async () => {
    if (!coachingForm.defi.trim()) return;
    setCoachingLoading(true);
    setCoachingResult('');
    try {
      const userPrompt = `Contexte professionnel :
- Entreprise / Organisation : ${coachingForm.entreprise || 'Non precise'}
- Secteur d'activite : ${coachingForm.secteur || 'Non precise'}
- Role / Fonction : ${coachingForm.role || 'Non precise'}
- Objectif coaching : ${coachingForm.objectif}

Defi principal :
${coachingForm.defi}

Fournis un plan d'action IA personnalise structure ainsi :
1. **Diagnostic rapide** : analyse de la situation et des opportunites IA specifiques
2. **3 actions prioritaires** : ce que tu peux faire des cette semaine avec l'IA
3. **Outils recommandes** : les outils IA les plus adaptes a ce contexte precis
4. **Cas d'usage concret** : un exemple detaille d'application IA sur ce defi
5. **Indicateurs de succes** : comment mesurer l'impact a 30 jours`;

      const seminarId = seminar?.id || participant.seminar;
      const result = await requestCoaching({
        seminar: seminarId,
        userPrompt,
      });

      if (result.error) {
        setCoachingResult(`Erreur : ${result.error}`);
      } else {
        setCoachingResult(result.text || 'Analyse generee avec succes.');
      }
      setCoachingSubmitted(true);
    } catch {
      setCoachingResult('Une erreur est survenue. Veuillez reessayer.');
      setCoachingSubmitted(true);
    }
    setCoachingLoading(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: 1, padding: '4px 10px', borderRadius: 6, background: 'rgba(201,168,76,0.12)' }}>
            COACHING IA
          </span>
          {isS1 ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, padding: '4px 10px', borderRadius: 6, background: 'rgba(39,174,96,0.1)' }}>
              INCLUS DANS VOTRE FORMATION
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, padding: '4px 10px', borderRadius: 6, background: 'rgba(27,42,74,0.08)' }}>
              {fmt(COACHING_PRICE)} FCFA / session de 2h
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Coaching IA Individuel</h1>
        <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 15, lineHeight: 1.6 }}>
          Appliquez directement l'IA a vos propres cas d'entreprise. Une session privee, sur-mesure, avec un expert.
        </p>
      </div>

      {/* What it is */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { icon: '🎯', title: 'Cas reels', desc: 'Travaillez sur vos propres defis d\'entreprise, pas des exemples generiques' },
          { icon: '🤖', title: 'IA appliquee', desc: 'Mise en pratique immediate des outils IA sur votre contexte professionnel' },
          { icon: '📋', title: 'Plan d\'action', desc: 'Repartez avec un plan concret et des prompts prets a utiliser' },
          { icon: '👤', title: 'Expert dedie', desc: 'Session 1-on-1 avec Djimtahadoum Memtingar, fondateur CABEXIA' },
        ].map((it, i) => (
          <div key={i} style={{ ...cardBase, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{it.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{it.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.55)', lineHeight: 1.5 }}>{it.desc}</div>
          </div>
        ))}
      </div>

      {/* Case form */}
      {!coachingSubmitted ? (
        <div style={{ ...cardBase, padding: 32, marginBottom: 32, borderTop: `4px solid ${GOLD}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Decrire votre cas</h2>
          <p style={{ fontSize: 13, color: 'rgba(27,42,74,0.55)', marginBottom: 24, lineHeight: 1.6 }}>
            Remplissez ce formulaire. Une analyse preliminaire par IA sera generee, puis notre expert vous contactera pour planifier votre session.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(27,42,74,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Votre entreprise / organisation</label>
              <input
                value={coachingForm.entreprise}
                onChange={e => setCoachingForm(f => ({ ...f, entreprise: e.target.value }))}
                placeholder="Ex : Banque SGBCI, Cabinet Dupont, OCHA CI..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', color: NAVY, fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(27,42,74,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Secteur d'activite</label>
              <input
                value={coachingForm.secteur}
                onChange={e => setCoachingForm(f => ({ ...f, secteur: e.target.value }))}
                placeholder="Ex : Banque, Notariat, RH, Sante..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', color: NAVY, fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(27,42,74,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Votre role / fonction</label>
              <input
                value={coachingForm.role}
                onChange={e => setCoachingForm(f => ({ ...f, role: e.target.value }))}
                placeholder="Ex : Directeur General, DAF, DRH..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', color: NAVY, fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(27,42,74,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Objectif de la session</label>
              <select
                value={coachingForm.objectif}
                onChange={e => setCoachingForm(f => ({ ...f, objectif: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', color: NAVY, fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif", background: '#fff', boxSizing: 'border-box' as const }}
              >
                {OBJECTIFS.map(obj => <option key={obj} value={obj}>{obj}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(27,42,74,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Decrivez votre defi principal <span style={{ color: '#E74C3C' }}>*</span>
            </label>
            <textarea
              value={coachingForm.defi}
              onChange={e => setCoachingForm(f => ({ ...f, defi: e.target.value }))}
              rows={5}
              placeholder="Decrivez le probleme ou la situation sur laquelle vous souhaitez travailler..."
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', color: NAVY, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: 'border-box' as const }}
            />
            <div style={{ fontSize: 11, color: 'rgba(27,42,74,0.35)', marginTop: 6 }}>
              Plus vous etes precis, plus l'analyse sera pertinente. {coachingForm.defi.length}/500 caracteres recommandes.
            </div>
          </div>

          <button
            onClick={handleCoachingAnalysis}
            disabled={!coachingForm.defi.trim() || coachingLoading}
            style={{
              padding: '14px 32px', borderRadius: 12, border: 'none', cursor: coachingForm.defi.trim() && !coachingLoading ? 'pointer' : 'not-allowed',
              background: coachingForm.defi.trim() && !coachingLoading ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : 'rgba(0,0,0,0.08)',
              color: coachingForm.defi.trim() && !coachingLoading ? NAVY : 'rgba(27,42,74,0.3)',
              fontWeight: 800, fontSize: 15, transition: 'all 0.3s',
            }}
          >
            {coachingLoading ? 'Analyse en cours...' : 'Generer mon plan d\'action IA'}
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {/* Result */}
          <div style={{ ...cardBase, padding: 32, borderTop: `4px solid ${GREEN}`, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(39,174,96,0.1)', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>&#x2713;</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>Analyse IA generee</div>
                <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.45)' }}>Plan d'action personnalise pour {coachingForm.entreprise || 'votre contexte'}</div>
              </div>
            </div>
            <div style={{
              background: 'rgba(27,42,74,0.025)', borderRadius: 12, padding: 24,
              fontSize: 14, color: NAVY, lineHeight: 1.8, whiteSpace: 'pre-wrap',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {coachingResult}
            </div>
          </div>

          {/* Next step: book session */}
          <div style={{ ...cardBase, padding: 24, background: `linear-gradient(135deg, rgba(201,168,76,0.06), rgba(27,42,74,0.03))`, borderLeft: `4px solid ${GOLD}` }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Prochaine etape : Session individuelle</div>
            <p style={{ fontSize: 13, color: 'rgba(27,42,74,0.6)', lineHeight: 1.6, marginBottom: 16 }}>
              Notre expert Djimtahadoum Memtingar vous contactera sous 48h pour planifier votre session de coaching de 2h.
              {isS1 ? ' Cette session est incluse dans votre formation Dirigeants.' : ` Tarif : ${fmt(COACHING_PRICE)} FCFA.`}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <a href="mailto:contact@cabex-ia.com" style={{ padding: '10px 20px', borderRadius: 10, background: NAVY, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>
                contact@cabex-ia.com
              </a>
              <button onClick={() => { setCoachingSubmitted(false); setCoachingResult(''); setCoachingForm({ entreprise: '', secteur: '', role: '', defi: '', objectif: 'Integration IA dans mon activite' }); }}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'transparent', color: NAVY, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Nouveau cas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formateur card */}
      <div style={{ ...cardBase, padding: 28, background: `linear-gradient(135deg, rgba(27,42,74,0.04), rgba(201,168,76,0.06))`, borderLeft: `4px solid ${GOLD}` }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Expert Formateur Principal</h2>
        <p style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)', marginBottom: 16 }}>Interlocuteur academique — sessions de coaching expert &amp; contenus pedagogiques</p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' as const }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${NAVY}, rgba(27,42,74,0.7))`, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>DM</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Djimtahadoum Memtingar</div>
            <div style={{ fontSize: 13, color: GOLD_DARK, fontWeight: 700, marginBottom: 4 }}>Expert-Consultant & Formateur en IA Generative</div>
            <div style={{ fontSize: 13, color: 'rgba(27,42,74,0.55)', marginBottom: 12 }}>Fondateur — CABEXIA</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {['230+ professionnels formes', '400+ ateliers', '10+ pays', '10 000+ personnes sensibilisees'].map(stat => (
                <span key={stat} style={{ fontSize: 11, fontWeight: 600, color: NAVY, background: 'rgba(27,42,74,0.06)', padding: '4px 10px', borderRadius: 6 }}>{stat}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Coaching Abidjan */}
      <div style={{ ...cardBase, padding: 28, borderLeft: `4px solid ${NAVY}`, marginTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Equipe Coaching Abidjan</h2>
        <p style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)', marginBottom: 20, lineHeight: 1.5 }}>
          Sessions pratiques en presentiel · Developpement de solutions IA sur-mesure · Assistance aux seminaires
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            {
              avatar: 'AD', name: 'Alexis Dogbo', role: 'Coaching IA & Transformation Digitale',
              bio: 'Specialiste en transformation digitale IA. Responsable du coaching a Abidjan et du developpement de solutions sur-mesure.',
              expertise: ['Transformation digitale', 'IA appliquee', 'Coaching entreprise', 'Solutions sur-mesure'],
            },
            {
              avatar: 'EA', name: 'Eric Atta', role: 'Coaching IA & Solutions Entreprise',
              bio: 'Expert en transformation digitale IA. Co-responsable du coaching a Abidjan et de l\'accompagnement des entreprises.',
              expertise: ['Transformation digitale', 'IA generative', 'Accompagnement entreprise', 'Developpement IA sur-mesure'],
            },
          ].map(member => (
            <div key={member.avatar} style={{
              background: 'rgba(27,42,74,0.025)', borderRadius: 14, padding: 20,
              border: '1px solid rgba(27,42,74,0.07)',
            }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${NAVY}, #2C3E6B)`,
                  color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 15, letterSpacing: 1,
                }}>
                  {member.avatar}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, lineHeight: 1.3 }}>{member.name}</div>
                  <div style={{ fontSize: 11, color: GOLD_DARK, fontWeight: 700, marginTop: 2 }}>{member.role}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(27,42,74,0.6)', lineHeight: 1.6, marginBottom: 12 }}>{member.bio}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                {member.expertise.map(tag => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: NAVY, background: 'rgba(27,42,74,0.07)', padding: '3px 8px', borderRadius: 5 }}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
