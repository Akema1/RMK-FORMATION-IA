import React, { useState } from 'react';
import { SEMINARS } from '../data/seminars';
import { btnPrimary, card, ORANGE } from './config';
import type { Seminar } from './types';
import { generateBrochurePdf } from './brochurePdf';

interface BrochurePageProps {
  seminars: Seminar[];
}

const NAVY = '#1B2A4A';
const GOLD = '#C9A84C';
const WHITE = '#FFFFFF';

export function BrochurePage({ seminars }: BrochurePageProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(SEMINARS.map(s => s.id))
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleSeminar = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(SEMINARS.map(s => s.id)));
  const selectNone = () => setSelectedIds(new Set());

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      generateBrochurePdf(selectedIds);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: NAVY, fontSize: 24, fontWeight: 800, margin: 0 }}>
          Generateur de Brochure
        </h2>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            ...btnPrimary,
            opacity: isGenerating ? 0.6 : 1,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? 'Generation...' : 'Generer la Brochure PDF'}
        </button>
      </div>

      {/* Seminar selection */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: NAVY, fontSize: 16, fontWeight: 700, margin: 0 }}>
            Seminaires a inclure
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={selectAll}
              style={{ background: 'none', border: `1px solid ${GOLD}`, color: GOLD, padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Tout selectionner
            </button>
            <button
              onClick={selectNone}
              style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', color: NAVY, padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Aucun
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {SEMINARS.map(sem => (
            <label
              key={sem.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 10,
                border: selectedIds.has(sem.id) ? `2px solid ${sem.color}` : '2px solid rgba(0,0,0,0.08)',
                background: selectedIds.has(sem.id) ? `${sem.color}0A` : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(sem.id)}
                onChange={() => toggleSeminar(sem.id)}
                style={{ accentColor: sem.color, width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>{sem.code} -- {sem.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)' }}>{sem.week}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Preview of brochure content */}
      <div style={{ ...card }}>
        <h3 style={{ color: NAVY, fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
          Apercu du contenu
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { num: 1, title: 'Couverture', desc: 'Page de garde avec branding RMK x CABEXIA' },
            { num: 2, title: 'Presentation', desc: 'Approche pedagogique, module commun, equipe' },
            { num: 3, title: 'Formations', desc: `${selectedIds.size} seminaire(s) en grille 2x2` },
            { num: 4, title: 'Tarifs', desc: 'Tableau des prix, remises pack, inscription' },
            { num: 5, title: 'Contact', desc: 'Points de confiance, coordonnees, copyright' },
          ].map(p => (
            <div
              key={p.num}
              style={{
                padding: 16,
                borderRadius: 10,
                background: p.num === 1 ? NAVY : 'rgba(0,0,0,0.03)',
                border: p.num === 1 ? 'none' : '1px solid rgba(0,0,0,0.08)',
                textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: 20,
                fontWeight: 800,
                color: p.num === 1 ? GOLD : NAVY,
                marginBottom: 4,
              }}>
                {p.num}
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: p.num === 1 ? WHITE : NAVY,
                marginBottom: 4,
              }}>
                {p.title}
              </div>
              <div style={{
                fontSize: 10,
                color: p.num === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                lineHeight: 1.3,
              }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
