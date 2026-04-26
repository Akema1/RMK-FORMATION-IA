// ─────────────────────────────────────────────
// Persistent banner shown on the portal dashboard after the participant
// dismisses the first-visit modal but hasn't completed the survey yet.
// ─────────────────────────────────────────────
import React from 'react';
import { NAVY } from './tokens';

interface Props {
  onOpen: () => void;
}

export function SurveyBanner({ onOpen }: Props) {
  return (
    <div style={{
      background: '#FFF8E1', border: '1px solid #C9A84C', borderRadius: 8,
      padding: '12px 20px', marginBottom: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    }}>
      <span style={{ color: NAVY, fontSize: 14 }}>
        Personnalisez votre formation en 2 minutes
      </span>
      <button
        onClick={onOpen}
        style={{
          background: NAVY, color: '#fff', border: 0, padding: '8px 16px',
          borderRadius: 6, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Commencer
      </button>
    </div>
  );
}
