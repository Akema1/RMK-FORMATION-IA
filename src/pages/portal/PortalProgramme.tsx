// ─────────────────────────────────────────────
// PORTAL PROGRAMME — Gated formation content (confirmed only)
// ─────────────────────────────────────────────
import React from 'react';
import { NAVY, GOLD, GOLD_DARK, WHITE, GREEN, cardBase } from './tokens';
import type { FormationContent } from './tokens';
import { FORMATION_CONTENT } from './formationContent';
import type { Seminar } from '../../data/seminars';
import type { Participant } from '../../admin/types';

export interface PortalProgrammeProps {
  participant: Participant;
  seminar: Seminar | null | undefined;
  openModule: number | null;
  setOpenModule: React.Dispatch<React.SetStateAction<number | null>>;
}

export default function PortalProgramme({
  participant, seminar,
  openModule, setOpenModule,
}: PortalProgrammeProps) {
  const content = seminar ? FORMATION_CONTENT[seminar.id] : null;

  if (participant.status !== 'confirmed') {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Mon Programme</h1>
          <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 15 }}>Contenu detaille de votre formation.</p>
        </div>
        <div style={{
          ...cardBase, padding: 48, textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(27,42,74,0.03), rgba(201,168,76,0.04))',
          border: '2px dashed rgba(201,168,76,0.3)',
        }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>&#x1F512;</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 12 }}>
            Programme disponible apres paiement
          </h2>
          <p style={{ color: 'rgba(27,42,74,0.55)', fontSize: 15, lineHeight: 1.7, maxWidth: 440, margin: '0 auto 24px' }}>
            Votre espace de formation complet — modules detailles, etudes de cas, ressources pedagogiques — sera accessible des reception de votre reglement.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            borderRadius: 10, background: 'rgba(243,156,18,0.1)',
            color: '#F39C12', fontWeight: 700, fontSize: 14,
            border: '1px solid rgba(243,156,18,0.2)',
          }}>
            Statut : En attente de validation du paiement
          </div>
        </div>
      </div>
    );
  }

  if (!seminar) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgba(27,42,74,0.4)' }}>
        Programme non disponible pour cette formation.
      </div>
    );
  }

  // Build fallback content from seminar's own data when not in FORMATION_CONTENT
  const displayContent: FormationContent = content ?? {
    subtitle: (seminar as unknown as Record<string, unknown>).flyer_subtitle as string || seminar.subtitle || 'Formation professionnelle en Intelligence Artificielle',
    public_cible: Array.isArray((seminar as unknown as Record<string, unknown>).targets)
      ? ((seminar as unknown as Record<string, unknown>).targets as string[]).join(', ')
      : seminar.target || '',
    methodology: ['Apprentissage pratique et mise en situation', 'Cas concrets issus de votre secteur', 'Exercices sur vos propres documents professionnels'],
    modules: (seminar.modules || []).map((mod: string) => ({
      title: mod,
      points: [
        `Comprendre et maitriser ${mod.toLowerCase()}`,
        'Applications concretes et mises en situation reelles',
        'Exercices guides avec vos propres cas professionnels',
      ],
    })),
    cas_pratiques: Array.isArray((seminar as unknown as Record<string, unknown>).flyer_bullets)
      ? ((seminar as unknown as Record<string, unknown>).flyer_bullets as string[])
      : seminar.highlights || [],
    resultats: [
      'Maitrise operationnelle des outils IA pour votre secteur',
      'Plan d\'action personnalise et immediatement applicable',
      'Gain de productivite mesurable des la semaine suivante',
      'Integration dans le reseau RMK x CABEXIA de professionnels formes',
    ],
    formateur: {
      name: 'Djimtahadoum Memtingar',
      title: 'Expert-Consultant & Formateur en IA Generative',
      company: 'CABEXIA — Cabinet d\'Expertise en Intelligence Artificielle',
      citation: 'Avec CABEXIA, l\'intelligence artificielle ne reste pas une promesse : elle devient un outil concret de performance, d\'impact et de transformation.',
    },
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: seminar.color, letterSpacing: 1,
            padding: '4px 10px', borderRadius: 6, background: `${seminar.color}18`,
          }}>
            {seminar.code}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: GREEN, padding: '4px 10px',
            borderRadius: 6, background: 'rgba(39,174,96,0.1)',
          }}>
            ACCES CONFIRME
          </span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 8, lineHeight: 1.3 }}>
          {seminar.title}
        </h1>
        <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 15, lineHeight: 1.6, fontStyle: 'italic' }}>
          {displayContent.subtitle}
        </p>
      </div>

      {/* Public cible */}
      <div style={{ ...cardBase, padding: 20, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${seminar.color}18`, color: seminar.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>&#x1F465;</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(27,42,74,0.4)', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>
            Public cible
          </div>
          <div style={{ fontSize: 14, color: NAVY, fontWeight: 600, lineHeight: 1.5 }}>
            {displayContent.public_cible}
          </div>
        </div>
      </div>

      {/* Modules — accordion */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
          Programme des modules
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayContent.modules.map((mod, i) => (
            <div key={i} style={{
              ...cardBase, overflow: 'hidden',
              borderLeft: openModule === i ? `4px solid ${seminar.color}` : '4px solid transparent',
              transition: 'all 0.3s',
            }}>
              <button
                onClick={() => setOpenModule(openModule === i ? null : i)}
                style={{
                  width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: openModule === i ? seminar.color : 'rgba(27,42,74,0.08)',
                    color: openModule === i ? WHITE : 'rgba(27,42,74,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, transition: 'all 0.3s',
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: NAVY, lineHeight: 1.4 }}>
                    {mod.title}
                  </span>
                </div>
                <span style={{ color: 'rgba(27,42,74,0.35)', fontSize: 16, flexShrink: 0, transition: 'transform 0.3s', transform: openModule === i ? 'rotate(180deg)' : 'none' }}>
                  &#x25BE;
                </span>
              </button>
              {openModule === i && (
                <div style={{ padding: '0 20px 20px 62px' }}>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mod.points.map((pt, j) => (
                      <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ color: seminar.color, fontSize: 16, flexShrink: 0, marginTop: 1 }}>&#x2713;</span>
                        <span style={{ fontSize: 14, color: 'rgba(27,42,74,0.75)', lineHeight: 1.6 }}>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cas pratiques */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
          Cas pratiques
        </h2>
        <div style={{ ...cardBase, padding: 24 }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayContent.cas_pratiques.map((cas, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🎯</span>
                <span style={{ fontSize: 14, color: NAVY, lineHeight: 1.6 }}>{cas}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Resultats attendus */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
          Resultats attendus
        </h2>
        <div style={{
          ...cardBase, padding: 24,
          background: 'linear-gradient(135deg, rgba(39,174,96,0.04), rgba(27,42,74,0.02))',
        }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayContent.resultats.map((res, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ color: GREEN, fontSize: 16, flexShrink: 0, marginTop: 1, fontWeight: 800 }}>&#x2192;</span>
                <span style={{ fontSize: 14, color: NAVY, lineHeight: 1.6, fontWeight: 500 }}>{res}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Formateur */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
          Votre Expert Formateur
        </h2>
        <div style={{
          ...cardBase, padding: 28,
          background: `linear-gradient(135deg, rgba(27,42,74,0.04), rgba(201,168,76,0.06))`,
          borderLeft: `4px solid ${GOLD}`,
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${NAVY}, rgba(27,42,74,0.7))`,
              color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 18, letterSpacing: 1,
            }}>
              DM
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 4 }}>
                {displayContent.formateur.name}
              </div>
              <div style={{ fontSize: 13, color: GOLD_DARK, fontWeight: 700, marginBottom: 4 }}>
                {displayContent.formateur.title}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(27,42,74,0.55)', marginBottom: 16 }}>
                {displayContent.formateur.company}
              </div>
              <blockquote style={{
                margin: 0, padding: '14px 18px',
                borderLeft: `3px solid ${GOLD}`,
                background: 'rgba(201,168,76,0.06)',
                borderRadius: '0 10px 10px 0',
                color: 'rgba(27,42,74,0.7)', fontSize: 13, lineHeight: 1.7, fontStyle: 'italic',
              }}>
                {displayContent.formateur.citation}
              </blockquote>
            </div>
          </div>
        </div>
      </div>

      {/* Methodologie */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(27,42,74,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
          Approche pedagogique
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {displayContent.methodology.map((meth, i) => (
            <div key={i} style={{
              ...cardBase, padding: '16px 18px',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>
                {['\uD83D\uDD2C', '\uD83D\uDCDA', '\uD83D\uDCA1', '\uD83C\uDFAD'][i % 4]}
              </span>
              <span style={{ fontSize: 13, color: NAVY, lineHeight: 1.6 }}>{meth}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
