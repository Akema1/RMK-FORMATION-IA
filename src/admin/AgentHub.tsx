import React, { useState } from 'react';
import { ORANGE } from './config';
import type { Seminar, Lead } from './types';
import { LeadsPage } from './LeadsPage';
import { AgentPage } from './AgentPage';
import { SeoAgentPage } from './SeoAgentPage';
import { WebProspectionPage } from './WebProspectionPage';
import { ResearchPage } from './ResearchPage';

interface AgentHubProps {
  seminars: Seminar[];
  leads: Lead[];
  refreshLeads: () => Promise<void>;
}

type HubTab = 'leads' | 'commercial' | 'seo' | 'prospection' | 'recherche';

const TABS: { key: HubTab; label: string; icon: string }[] = [
  { key: 'leads', label: 'CRM Leads', icon: '📋' },
  { key: 'commercial', label: 'Agent Commercial', icon: '🤖' },
  { key: 'seo', label: 'Agent SEO', icon: '🔍' },
  { key: 'prospection', label: 'Prospection Web', icon: '🌐' },
  { key: 'recherche', label: 'Recherche', icon: '📊' },
];

export function AgentHub({ seminars, leads, refreshLeads }: AgentHubProps) {
  const [tab, setTab] = useState<HubTab>('leads');

  return (
    <div>
      <h2 style={{ color: '#1B2A4A', fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>Agents & Prospection</h2>
      <p style={{ color: '#1B2A4A', fontSize: 14, margin: '0 0 24px' }}>
        CRM, prospection automatisee, SEO et recherche — tous vos outils commerciaux au meme endroit.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: tab === t.key ? 700 : 500, fontSize: 12,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#1B2A4A' : '#64748B',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
            {t.key === 'leads' && <span style={{ marginLeft: 4, fontSize: 10, color: ORANGE, fontWeight: 700 }}>({leads.length})</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'leads' && <LeadsPage leads={leads} refreshLeads={refreshLeads} />}
      {tab === 'commercial' && <AgentPage seminars={seminars} />}
      {tab === 'seo' && <SeoAgentPage seminars={seminars} />}
      {tab === 'prospection' && <WebProspectionPage seminars={seminars} leads={leads} refreshLeads={refreshLeads} />}
      {tab === 'recherche' && <ResearchPage seminars={seminars} />}
    </div>
  );
}
