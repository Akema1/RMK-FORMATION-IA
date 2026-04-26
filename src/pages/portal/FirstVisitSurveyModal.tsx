// ─────────────────────────────────────────────
// First-visit survey modal — shown once when a confirmed participant lands
// on /portal with onboarding_completed_at IS NULL. Wraps PortalSurvey.
// ─────────────────────────────────────────────
import React from 'react';
import PortalSurvey from './PortalSurvey';
import { NAVY } from './tokens';

interface Props {
  participantId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export function FirstVisitSurveyModal({ participantId, onComplete, onDismiss }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-survey-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%',
        padding: 32, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 id="first-visit-survey-title" style={{ marginTop: 0, color: NAVY }}>
          Personnalisez votre formation
        </h2>
        <p style={{ color: '#666', marginBottom: 16 }}>
          5 questions, 2 minutes. Vos réponses nous aident à adapter la formation à vos besoins.
        </p>
        <PortalSurvey participantId={participantId} onComplete={onComplete} />
        <button onClick={onDismiss} style={{
          marginTop: 16, background: 'transparent', border: 0,
          color: '#888', cursor: 'pointer', fontSize: 14,
        }}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
