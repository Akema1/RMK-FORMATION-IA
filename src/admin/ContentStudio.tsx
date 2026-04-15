import React, { useState } from 'react';
import { card, ORANGE } from './config';
import type { Seminar, Participant } from './types';
import { BrochurePage } from './BrochurePage';
import { FlyerPage } from './FlyerPage';
import { CertificatePage } from './CertificatePage';
import { InvitationPage } from './InvitationPage';

interface ContentStudioProps {
  seminars: Seminar[];
  participants: Participant[];
}

type StudioTab = 'brochure' | 'flyer' | 'certificats' | 'invitations';

const TABS: { key: StudioTab; label: string; icon: string }[] = [
  { key: 'brochure', label: 'Brochure', icon: '📄' },
  { key: 'flyer', label: 'Flyer', icon: '🖼' },
  { key: 'certificats', label: 'Certificats', icon: '🎓' },
  { key: 'invitations', label: 'Invitations', icon: '✉' },
];

export function ContentStudio({ seminars, participants }: ContentStudioProps) {
  const [tab, setTab] = useState<StudioTab>('brochure');

  return (
    <div>
      <h2 style={{ color: '#1B2A4A', fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>Studio de Contenus</h2>
      <p style={{ color: '#1B2A4A', fontSize: 14, margin: '0 0 24px' }}>
        Creez brochures, flyers, certificats et cartes d'invitation pour vos formations.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: tab === t.key ? 700 : 500, fontSize: 13,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#1B2A4A' : '#64748B',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
            {tab === t.key && <span style={{ marginLeft: 6, fontSize: 11, color: ORANGE, fontWeight: 700 }}>●</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'brochure' && <BrochurePage seminars={seminars} />}
      {tab === 'flyer' && <FlyerPage seminars={seminars} />}
      {tab === 'certificats' && <CertificatePage seminars={seminars} participants={participants} />}
      {tab === 'invitations' && <InvitationPage seminars={seminars} />}
    </div>
  );
}
