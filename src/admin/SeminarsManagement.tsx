import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fmt } from '../data/seminars';
import {
  card, inputS, btnPrimary, btnSecondary, label, ORANGE, badge,
  ICON_EMOJI, DEFAULT_BUDGET_CONFIG, DEFAULT_SEMINAR_PRICING, DEFAULT_VENUES, DEFAULT_SPEAKERS, DEFAULT_FORMATION_TEMPLATES
} from './config';
import type { Seminar, BudgetConfig, Prices, SeminarPricing, SeminarPricingConfigs, Venue, Speaker, FormationTemplate } from './types';

// ─── Constants ───
const SECTORS = ['Tous', 'Direction', 'Finance', 'Juridique', 'RH', 'Santé', 'Marketing', 'Comptabilité', 'Éducation', 'Administration', 'Entrepreneuriat', 'Logistique', 'Banque'];
const STATUSES = [
  { value: 'draft', label: 'Brouillon', color: '#94A3B8' },
  { value: 'planned', label: 'Planifié', color: '#3B82F6' },
  { value: 'ongoing', label: 'En cours', color: '#27AE60' },
  { value: 'done', label: 'Terminé', color: '#64748B' },
];
const BUDGET_LABELS: Record<string, string> = {
  consultance_pres: 'Consultance (présentiel)', consultance_ligne: 'Consultance (en ligne)',
  billet_avion: "Billet d'avion", sejour: 'Hébergement / Séjour', salle: 'Location salle',
  pauses_cafe: 'Pauses café', dejeuner: 'Déjeuners', supports: 'Supports pédagogiques',
  equipements: 'Équipements', divers: 'Divers & Imprévus', transport: 'Transport local',
};

// ─── Wizard Data ───
interface WizardData {
  template: FormationTemplate | null;
  form: Partial<Seminar> & { status?: string };
  venue: Venue | null;
  speakers: Speaker[];
  budgetOverrides: Partial<BudgetConfig>;
  pricing: Partial<SeminarPricing>;
}

// ─── Props ───
interface SeminarsManagementProps {
  seminars: Seminar[];
  refreshSeminars: () => Promise<void>;
  prices: Prices;
  setPrices: (p: Prices) => void;
  seminarPricing: SeminarPricingConfigs;
  setSeminarPricing: (sp: SeminarPricingConfigs) => void;
}

// ─── Pricing Suggestion Panel (used in edit form) ───
function PricingSuggestionPanel({ seats, seminarCode, customBudgetTotal }: { seats: number; seminarCode: string; customBudgetTotal?: number }) {
  const [show, setShow] = useState(false);
  const suggestions = useMemo(() => {
    const totalBudget = customBudgetTotal ?? Object.entries(DEFAULT_BUDGET_CONFIG).reduce((s, [k, v]) => k === 'commercialisation_pct' ? s : s + v, 0);
    const scenarios = [8, 10, 12, 15, 20].map(pax => {
      const costPerPax = Math.ceil(totalBudget / pax);
      return { pax, costPerPax, m20: Math.ceil(costPerPax * 1.2), m30: Math.ceil(costPerPax * 1.3), m40: Math.ceil(costPerPax * 1.4), earlyBird: Math.ceil(costPerPax * 1.3 * 0.9) };
    });
    return { totalBudget, scenarios, isDirigeants: seminarCode?.toUpperCase() === 'S1' };
  }, [seats, seminarCode, customBudgetTotal]);

  if (!show) return (
    <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 16 }}>
      <button onClick={() => setShow(true)} style={{ ...btnSecondary, borderColor: `${ORANGE}44`, color: ORANGE, fontSize: 12 }}>
        💡 Voir les suggestions de tarification
      </button>
    </div>
  );
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, color: ORANGE, fontWeight: 700, margin: 0 }}>💡 Tarification Suggérée</h4>
        <button onClick={() => setShow(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 18 }}>✕</button>
      </div>
      <div style={{ background: "rgba(0,0,0,0.02)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr 1fr 1fr 1fr 1fr", padding: "10px 14px", background: "#1B2A4A", color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
          <div>Participants</div><div>Coût / pers.</div><div>Marge 20%</div><div style={{ color: ORANGE }}>Marge 30% ★</div><div>Marge 40%</div><div>Early Bird</div>
        </div>
        {suggestions.scenarios.map(s => (
          <div key={s.pax} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr 1fr 1fr 1fr 1fr", padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: 12, background: s.pax === seats ? "rgba(201,168,76,0.08)" : "transparent" }}>
            <div style={{ fontWeight: 700, color: "#1B2A4A" }}>{s.pax} pax</div>
            <div style={{ color: "#E74C3C", fontWeight: 600 }}>{fmt(s.costPerPax)} F</div>
            <div>{fmt(s.m20)} F</div>
            <div style={{ color: ORANGE, fontWeight: 700 }}>{fmt(s.m30)} F</div>
            <div>{fmt(s.m40)} F</div>
            <div style={{ color: "#27AE60", fontWeight: 600 }}>{fmt(s.earlyBird)} F</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───
export function SeminarsManagement({ seminars, refreshSeminars, prices, setPrices, seminarPricing, setSeminarPricing }: SeminarsManagementProps) {
  // Studio tab
  const [studioTab, setStudioTab] = useState<'seminaires' | 'catalogue' | 'venues' | 'speakers' | 'tarification'>('seminaires');

  // Existing edit form (for editing existing seminars)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Seminar>>({ code: '', title: '', week: '', icon: 'Briefcase', color: '#C9A84C', seats: 20 });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizard, setWizard] = useState<WizardData>({
    template: null,
    form: { code: '', title: '', week: '', icon: 'Briefcase', color: '#C9A84C', seats: 15, status: 'planned' },
    venue: null, speakers: [], budgetOverrides: {}, pricing: {},
  });
  const [wizardSaveStatus, setWizardSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [wizardSaveError, setWizardSaveError] = useState('');

  // Speaker bio modal
  const [selectedSpeakerBio, setSelectedSpeakerBio] = useState<Speaker | null>(null);
  const [deleteConfirmSem, setDeleteConfirmSem] = useState<string | null>(null);

  // Filters
  const [catalogSector, setCatalogSector] = useState('Tous');
  const [venueZone, setVenueZone] = useState('Toutes');
  const [venueMinStars, setVenueMinStars] = useState(0);
  const [speakerSearch, setSpeakerSearch] = useState('');
  const [localVenues] = useState<Venue[]>(DEFAULT_VENUES);
  const [localSpeakers] = useState<Speaker[]>(DEFAULT_SPEAKERS);

  // Filtered data
  const filteredTemplates = useMemo(() =>
    catalogSector === 'Tous' ? DEFAULT_FORMATION_TEMPLATES : DEFAULT_FORMATION_TEMPLATES.filter(t => t.sector === catalogSector),
    [catalogSector]);
  const filteredVenues = useMemo(() =>
    localVenues.filter(v => (venueZone === 'Toutes' || v.zone === venueZone) && (venueMinStars === 0 || v.stars >= venueMinStars)),
    [localVenues, venueZone, venueMinStars]);
  const filteredSpeakers = useMemo(() => {
    const q = speakerSearch.toLowerCase();
    return localSpeakers.filter(s => !q || s.name.toLowerCase().includes(q) || s.expertise.some(e => e.toLowerCase().includes(q)));
  }, [localSpeakers, speakerSearch]);

  // ─── Wizard Budget Auto-Calculation ───
  const wizardBudget = useMemo(() => {
    const { template, venue, speakers: spks, form: wf, budgetOverrides } = wizard;
    const duration = template?.duration_days || 5;
    const seats = Number(wf.seats) || 15;
    const b: BudgetConfig = { ...DEFAULT_BUDGET_CONFIG };
    if (venue) b.salle = venue.tarif_journee * duration;
    if (spks.length > 0) {
      b.consultance_pres = spks.reduce((sum, sp) => sum + sp.tarif_journee * duration, 0);
      b.billet_avion = 0; b.sejour = 0;
    }
    b.pauses_cafe = seats * 5000 * duration;
    b.dejeuner = seats * 15000 * duration;
    b.supports = seats * 5000;
    Object.assign(b, budgetOverrides);
    const total = Object.entries(b).reduce((s, [k, v]) => k === 'commercialisation_pct' ? s : s + v, 0);
    const marketing = Math.round(total * b.commercialisation_pct);
    const grandTotal = total + marketing;
    const breakeven = Math.ceil(grandTotal / seats / 10000) * 10000;
    return { b, total, marketing, grandTotal, breakeven };
  }, [wizard]);

  // ─── Save existing seminar (edit mode) ───
  const saveSeminar = async () => {
    if (!form.code || !form.title) return;
    setSaveStatus('saving'); setSaveError('');
    const payload: Record<string, unknown> = {
      code: form.code, title: form.title, week: form.week || '',
      icon: form.icon || 'Briefcase', color: form.color || '#C9A84C',
      seats: Number(form.seats) || 20,
      targets: typeof form.targets === 'string' ? (form.targets as string).split(',').map(s => s.trim()).filter(Boolean) : (form.targets || []),
      sectors: typeof form.sectors === 'string' ? (form.sectors as string).split(',').map(s => s.trim()).filter(Boolean) : (form.sectors || []),
      flyer_subtitle: form.flyer_subtitle || '', flyer_highlight: form.flyer_highlight || '',
      flyer_bullets: typeof form.flyer_bullets === 'string' ? (form.flyer_bullets as string).split(',').map(s => s.trim()).filter(Boolean) : (form.flyer_bullets || []),
      flyer_image: form.flyer_image || '',
    };
    if ((form as Seminar & { dates?: { start?: string } }).dates?.start) payload.dates = (form as Seminar & { dates?: unknown }).dates;
    const isValidUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const attemptSave = async (data: Record<string, unknown>) => {
      if (editingId && isValidUUID(editingId)) {
        return await supabase.from('seminars').update(data).eq('id', editingId);
      }
      // Generate a proper UUID for new seminars (Supabase expects UUID, not "s1"/"s4")
      const newId = crypto.randomUUID();
      return await supabase.from('seminars').insert([{ ...data, id: newId }]);
    };
    try {
      let result = await attemptSave(payload);
      if (result.error) {
        // Schema drift: the seminars table may not have all columns we're trying
        // to write (e.g., dates, flyer_image were added in later migrations).
        // Instead of parsing error strings, strip optional fields and retry.
        const OPTIONAL_FIELDS = ['dates', 'flyer_image', 'flyer_highlight'];
        const retryPayload = { ...payload };
        let stripped = false;
        for (const field of OPTIONAL_FIELDS) {
          if (field in retryPayload) {
            delete retryPayload[field];
            stripped = true;
          }
        }
        if (stripped) {
          result = await attemptSave(retryPayload);
        }
      }
      if (result.error) throw new Error(result.error.message);
      setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 2000);
      setEditingId(null); setShowForm(false);
      setForm({ code: '', title: '', week: '', icon: 'Briefcase', color: '#C9A84C', seats: 20 });
      refreshSeminars();
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Erreur'); setSaveStatus('error'); }
  };

  // ─── Save wizard seminar ───
  const saveWizardSeminar = async () => {
    const { template, form: wf, venue, speakers: spks } = wizard;
    setWizardSaveStatus('saving'); setWizardSaveError('');
    const id = crypto.randomUUID();
    const payload: Record<string, unknown> = {
      id, code: wf.code || `S${Date.now()}`, title: wf.title || template?.title || '',
      week: wf.week || '', icon: wf.icon || 'Briefcase', color: wf.color || '#C9A84C',
      seats: Number(wf.seats) || 15,
      targets: template ? [template.target_audience] : [],
      sectors: template ? [template.sector] : [],
    };
    try {
      let result = await supabase.from('seminars').insert([payload]);
      if (result.error) {
        // Schema drift: the seminars table may not have all columns we're trying
        // to write (e.g., dates, flyer_image were added in later migrations).
        // Instead of parsing error strings, strip optional fields and retry.
        const OPTIONAL_FIELDS = ['dates', 'flyer_image', 'flyer_highlight'];
        const retryPayload = { ...payload };
        let stripped = false;
        for (const field of OPTIONAL_FIELDS) {
          if (field in retryPayload) {
            delete retryPayload[field];
            stripped = true;
          }
        }
        if (stripped) {
          result = await supabase.from('seminars').insert([retryPayload]);
        }
      }
      if (result.error) throw new Error(result.error.message);
      // Save budget to settings (use seminar_budgets global key, not per-seminar)
      const { data: existing } = await supabase.from('settings').select('value').eq('id', 'seminar_budgets').single();
      const budgets = (existing?.value || {}) as Record<string, unknown>;
      budgets[id] = wizardBudget.b;
      await supabase.from('settings').upsert({ id: 'seminar_budgets', value: budgets });
      // Save per-seminar pricing
      const wp = wizard.pricing;
      const semPricing: SeminarPricing = {
        price: wp.price ?? Math.ceil(wizardBudget.breakeven * 1.3),
        earlyBirdPct: wp.earlyBirdPct ?? prices.discountPct,
        coachingPrice: wp.coachingPrice ?? prices.coaching,
        packDiscount3Enabled: wp.packDiscount3Enabled ?? true,
        packDiscount2semEnabled: wp.packDiscount2semEnabled ?? true,
        packDiscount4semEnabled: wp.packDiscount4semEnabled ?? true,
      };
      saveSeminarPricingFor(id, semPricing);
      setWizardSaveStatus('success');
      setTimeout(() => { setWizardSaveStatus('idle'); setWizardOpen(false); resetWizard(); }, 2000);
      refreshSeminars();
    } catch (err) { setWizardSaveError(err instanceof Error ? err.message : 'Erreur'); setWizardSaveStatus('error'); }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizard({ template: null, form: { code: '', title: '', week: '', icon: 'Briefcase', color: '#C9A84C', seats: 15, status: 'planned' }, venue: null, speakers: [], budgetOverrides: {}, pricing: {} });
  };

  const openWizard = (template?: FormationTemplate) => {
    resetWizard();
    if (template) {
      setWizard(w => ({ ...w, template, form: { ...w.form, title: template.title, code: template.code, seats: template.max_participants, status: 'planned' } }));
      setWizardStep(2);
    }
    setWizardOpen(true);
  };

  const startEdit = (s: Seminar) => { setForm(s); setEditingId(s.id); setShowForm(true); setStudioTab('seminaires'); };
  const deleteSeminar = async (id: string) => {
    await supabase.from('seminars').delete().eq('id', id);
    setDeleteConfirmSem(null);
    refreshSeminars();
  };

  // ─── Tab: Mes Séminaires ───
  const renderSeminairesTab = () => (
    <div>
      {showForm && (
        <div style={{ ...card, marginBottom: 24, borderLeft: `3px solid ${ORANGE}` }}>
          <h3 style={{ color: '#1B2A4A', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editingId ? 'Modifier le séminaire' : 'Ajouter un séminaire'}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={label}>Code</label><input style={inputS} value={form.code} onChange={upd('code')} /></div>
            <div><label style={label}>Titre</label><input style={inputS} value={form.title} onChange={upd('title')} /></div>
            <div><label style={label}>Libellé dates</label><input style={inputS} value={form.week} onChange={upd('week')} /></div>
            <div><label style={label}>Date début</label><input type="date" style={inputS} value={(form as Seminar & { dates?: { start?: string } }).dates?.start || ''} onChange={e => setForm(f => ({ ...f, dates: { ...(f as Seminar & { dates?: Record<string, string> }).dates, start: e.target.value } as unknown as undefined }))} /></div>
            <div><label style={label}>Places</label><input type="number" style={inputS} value={form.seats} onChange={upd('seats')} /></div>
            <div>
              <label style={label}>Icon</label>
              <select style={{ ...inputS, cursor: 'pointer' }} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}>
                <option value="Briefcase">💼 Dirigeants</option>
                <option value="BarChart3">📊 Finance</option>
                <option value="Scale">⚖️ Juridique</option>
                <option value="Users">👥 RH</option>
              </select>
            </div>
            <div><label style={label}>Couleur</label><input type="color" style={{ ...inputS, height: 42, padding: 4 }} value={form.color} onChange={upd('color')} /></div>
          </div>
          <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, color: ORANGE, fontWeight: 700, marginBottom: 12 }}>Flyer & Marketing</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={label}>Sous-titre flyer</label><input style={inputS} value={form.flyer_subtitle} onChange={upd('flyer_subtitle')} /></div>
              <div><label style={label}>Image flyer (URL)</label><input style={inputS} value={form.flyer_image} onChange={upd('flyer_image')} /></div>
            </div>
            <div style={{ marginTop: 12 }}><label style={label}>Accroche</label><textarea style={{ ...inputS, height: 60 } as React.CSSProperties} value={form.flyer_highlight} onChange={upd('flyer_highlight')} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <div><label style={label}>Points clés (virgules)</label><textarea style={{ ...inputS, height: 80 } as React.CSSProperties} value={Array.isArray(form.flyer_bullets) ? form.flyer_bullets.join(', ') : form.flyer_bullets} onChange={upd('flyer_bullets')} /></div>
              <div><label style={label}>Cibles (virgules)</label><textarea style={{ ...inputS, height: 80 } as React.CSSProperties} value={Array.isArray(form.targets) ? form.targets.join(', ') : form.targets} onChange={upd('targets')} /></div>
              <div><label style={label}>Secteurs (virgules)</label><textarea style={{ ...inputS, height: 80 } as React.CSSProperties} value={Array.isArray(form.sectors) ? form.sectors.join(', ') : form.sectors} onChange={upd('sectors')} /></div>
            </div>
          </div>
          <PricingSuggestionPanel seats={Number(form.seats) || 20} seminarCode={form.code || ''} />
          {saveError && <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 8, color: "#E74C3C", fontSize: 13 }}>⚠️ {saveError}</div>}
          {saveStatus === 'success' && <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(39,174,96,0.1)", border: "1px solid rgba(39,174,96,0.3)", borderRadius: 8, color: "#27AE60", fontSize: 13 }}>✅ Séminaire enregistré</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={saveSeminar} disabled={saveStatus === 'saving'} style={{ ...btnPrimary, opacity: saveStatus === 'saving' ? 0.6 : 1 }}>{saveStatus === 'saving' ? '⏳ Enregistrement...' : 'Enregistrer'}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={btnSecondary}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.5fr 3fr 2fr 1fr 1fr 1fr", padding: "12px 16px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.4)", textTransform: "uppercase" as const }}>
          <div>Code</div><div>Formation</div><div>Dates</div><div>Places</div><div>Statut</div><div>Actions</div>
        </div>
        {seminars.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
            Aucun séminaire créé. Utilisez le bouton <strong style={{ color: ORANGE }}>"+ Nouveau Séminaire"</strong> ou le <strong style={{ color: ORANGE }}>Catalogue de Formations</strong>.
          </div>
        )}
        {seminars.map((s: Seminar) => {
          const st = STATUSES.find(x => x.value === (s as Seminar & { status?: string }).status) || STATUSES[1];
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "0.5fr 3fr 2fr 1fr 1fr 1fr", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
              <div style={{ fontWeight: 700, color: s.color }}>{s.code}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{ICON_EMOJI[s.icon] || '📋'} {s.title}</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{s.week || '—'}</div>
              <div style={{ fontSize: 12 }}>{s.seats} places</div>
              <div><span style={{ ...badge(st.color), fontSize: 10 }}>{st.label}</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => startEdit(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }} title="Modifier">✏️</button>
                {deleteConfirmSem === s.id ? (
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => deleteSeminar(s.id)} style={{ background: '#DC2626', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Oui</button>
                    <button onClick={() => setDeleteConfirmSem(null)} style={{ background: '#94A3B8', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Non</button>
                  </span>
                ) : (
                  <button onClick={() => setDeleteConfirmSem(s.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }} title="Supprimer">🗑</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── Tab: Catalogue ───
  const renderCatalogueTab = () => (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 20 }}>
        {SECTORS.map(s => (
          <button key={s} onClick={() => setCatalogSector(s)} style={{ padding: "6px 14px", borderRadius: 100, border: `1px solid ${catalogSector === s ? ORANGE : 'rgba(0,0,0,0.12)'}`, background: catalogSector === s ? `${ORANGE}18` : 'transparent', color: catalogSector === s ? ORANGE : '#64748B', fontWeight: catalogSector === s ? 700 : 400, fontSize: 12, cursor: 'pointer' }}>{s}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {filteredTemplates.map(t => (
          <div key={t.id} style={{ ...card, display: "flex", flexDirection: "column" as const, gap: 8, borderTop: `3px solid ${ORANGE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ ...badge('#3B82F6'), fontSize: 10 }}>{t.sector}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{t.duration_days}j</span>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1B2A4A', margin: 0 }}>{t.title}</h3>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{t.description.slice(0, 80)}…</p>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>👥 {t.target_audience.slice(0, 40)}</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 4 }}>
              {t.tags.slice(0, 3).map(tag => <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(0,0,0,0.05)", color: '#64748B' }}>{tag}</span>)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <span style={{ fontWeight: 800, color: '#1B2A4A', fontSize: 15 }}>{fmt(t.base_price)} F</span>
              <button onClick={() => { setStudioTab('seminaires'); openWizard(t); }} style={{ ...btnPrimary, padding: "8px 16px", fontSize: 12 }}>Créer →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Tab: Hôtels & Salles ───
  const renderVenuesTab = () => (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        <select style={{ ...inputS, width: 'auto', minWidth: 140 }} value={venueZone} onChange={e => setVenueZone(e.target.value)}>
          {['Toutes', 'Plateau', 'Cocody', 'Zone 4'].map(z => <option key={z}>{z}</option>)}
        </select>
        <select style={{ ...inputS, width: 'auto', minWidth: 160 }} value={venueMinStars} onChange={e => setVenueMinStars(Number(e.target.value))}>
          <option value={0}>Toutes les étoiles</option>
          <option value={3}>3★ et plus</option>
          <option value={4}>4★ et plus</option>
          <option value={5}>5★ uniquement</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>{filteredVenues.length} lieu(x)</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 0.8fr 1.2fr 1.5fr", padding: "12px 16px", background: "#1B2A4A", color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const }}>
          <div>Hôtel / Lieu</div><div>Zone</div><div>★</div><div>Cap. séminaire</div><div>Tarif / jour</div><div>Contact</div>
        </div>
        {filteredVenues.map(v => (
          <details key={v.id}>
            <summary style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 0.8fr 1.2fr 1.5fr", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center", cursor: 'pointer', listStyle: 'none' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1B2A4A' }}>{v.name}</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{v.zone}</div>
              <div style={{ fontSize: 12 }}>{'★'.repeat(v.stars)}</div>
              <div style={{ fontSize: 12 }}>{v.capacity_seminar} pers.</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>{fmt(v.tarif_journee)} F</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{v.contact_name}</div>
            </summary>
            <div style={{ padding: "12px 16px 16px", background: "rgba(201,168,76,0.04)", borderBottom: "1px solid rgba(0,0,0,0.04)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, marginBottom: 4 }}>Tarifs</div>
                <div style={{ fontSize: 12 }}>½ journée : <strong>{fmt(v.tarif_demi_journee)} F</strong></div>
                <div style={{ fontSize: 12 }}>Journée : <strong>{fmt(v.tarif_journee)} F</strong></div>
                <div style={{ fontSize: 12 }}>Semaine : <strong>{fmt(v.tarif_semaine)} F</strong></div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, marginBottom: 4 }}>Contact</div>
                <div style={{ fontSize: 12 }}>{v.contact_phone}</div>
                <div style={{ fontSize: 12 }}>{v.contact_email}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, marginBottom: 4 }}>Services</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                  {v.services.map(s => <span key={s} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(39,174,96,0.1)", color: "#27AE60" }}>{s}</span>)}
                </div>
                {v.notes && <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontStyle: 'italic' }}>{v.notes}</div>}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );

  // ─── Tab: Intervenants ───
  const renderSpeakersTab = () => (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input style={{ ...inputS, maxWidth: 320 }} placeholder="🔍 Rechercher par nom ou expertise…" value={speakerSearch} onChange={e => setSpeakerSearch(e.target.value)} />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>{filteredSpeakers.length} intervenant(s)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {filteredSpeakers.map(sp => (
          <div key={sp.id} style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: sp.disponible ? `${ORANGE}22` : 'rgba(0,0,0,0.08)', color: sp.disponible ? ORANGE : '#94A3B8', display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{sp.avatar_initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1B2A4A', margin: 0 }}>{sp.name}</h3>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{sp.title}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{sp.company}</div>
                </div>
                <span style={{ ...badge(sp.disponible ? '#27AE60' : '#94A3B8'), fontSize: 10, flexShrink: 0 }}>{sp.disponible ? 'Disponible' : 'Indisponible'}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 8 }}>
                {sp.expertise.slice(0, 3).map(e => <span key={e} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(59,130,246,0.1)", color: '#3B82F6' }}>{e}</span>)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12 }}><strong style={{ color: ORANGE }}>{fmt(sp.tarif_journee)} F</strong> <span style={{ color: '#94A3B8' }}>/ jour</span></div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: '#64748B' }}>
                  {sp.langues.join(' · ')}
                  {sp.linkedin_url && <a href={sp.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', textDecoration: 'none' }}>LinkedIn ↗</a>}
                </div>
              </div>
              {sp.note && <div style={{ marginTop: 8, fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>{sp.note}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <a href={`mailto:${sp.email}`} style={{ fontSize: 11, color: '#64748B' }}>✉ {sp.email}</a>
                <span style={{ color: '#DDD' }}>·</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>📞 {sp.phone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Wizard Modal ───
  const STEP_LABELS = ['Modèle', 'Configuration', 'Lieu', 'Intervenants', 'Budget'];

  const renderWizard = () => {
    if (!wizardOpen) return null;
    const w = wizard;

    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#FAF9F6", borderRadius: 20, width: "min(92vw, 900px)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
          {/* Header */}
          <div style={{ padding: "24px 28px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1B2A4A', margin: 0 }}>🎓 Créer un Séminaire</h2>
              <button onClick={() => { setWizardOpen(false); resetWizard(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: '#94A3B8' }}>✕</button>
            </div>
            {/* Step indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 0 }}>
              {STEP_LABELS.map((lbl, i) => {
                const step = i + 1;
                const done = step < wizardStep;
                const active = step === wizardStep;
                return (
                  <React.Fragment key={step}>
                    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: done ? "#27AE60" : active ? ORANGE : "rgba(0,0,0,0.08)", color: done || active ? "#fff" : "#94A3B8", transition: "all 0.2s" }}>{done ? "✓" : step}</div>
                      <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? ORANGE : done ? "#27AE60" : "#94A3B8", whiteSpace: "nowrap" as const }}>{lbl}</span>
                    </div>
                    {i < 4 && <div style={{ flex: 1, height: 2, background: done ? "#27AE60" : "rgba(0,0,0,0.08)", margin: "0 4px", marginBottom: 14, transition: "all 0.2s" }} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div style={{ padding: "24px 28px" }}>
            {/* Step 1: Choose Template */}
            {wizardStep === 1 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B2A4A', marginBottom: 16 }}>Choisir un modèle de formation</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxHeight: 380, overflow: "auto" }}>
                  {DEFAULT_FORMATION_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { setWizard(prev => ({ ...prev, template: t, form: { ...prev.form, title: t.title, code: t.code, seats: t.max_participants } })); setWizardStep(2); }}
                      style={{ textAlign: 'left' as const, padding: 14, borderRadius: 12, border: `2px solid ${w.template?.id === t.id ? ORANGE : 'rgba(0,0,0,0.1)'}`, background: w.template?.id === t.id ? `${ORANGE}10` : '#fff', cursor: 'pointer' }}>
                      <div style={{ fontSize: 10, color: '#3B82F6', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>{t.sector}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2A4A' }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{t.duration_days}j · {fmt(t.base_price)} F</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setWizardStep(2)} style={{ ...btnSecondary, marginTop: 16, fontSize: 12 }}>Partir de zéro (sans modèle) →</button>
              </div>
            )}

            {/* Step 2: Configuration */}
            {wizardStep === 2 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B2A4A', marginBottom: 4 }}>Configuration du séminaire</h3>
                {w.template && <div style={{ fontSize: 12, color: ORANGE, marginBottom: 16, fontWeight: 600 }}>📋 Basé sur : {w.template.title}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><label style={label}>Titre de la formation</label><input style={inputS} value={w.form.title || ''} onChange={e => setWizard(prev => ({ ...prev, form: { ...prev.form, title: e.target.value } }))} /></div>
                  <div><label style={label}>Code interne (ex: S5)</label><input style={inputS} value={w.form.code || ''} onChange={e => setWizard(prev => ({ ...prev, form: { ...prev.form, code: e.target.value } }))} /></div>
                  <div><label style={label}>Libellé dates (ex: 19 – 23 Mai 2026)</label><input style={inputS} value={w.form.week || ''} onChange={e => setWizard(prev => ({ ...prev, form: { ...prev.form, week: e.target.value } }))} /></div>
                  <div><label style={label}>Participants max</label><input type="number" style={inputS} value={w.form.seats || 15} onChange={e => setWizard(prev => ({ ...prev, form: { ...prev.form, seats: Number(e.target.value) } }))} /></div>
                  <div>
                    <label style={label}>Statut</label>
                    <select style={{ ...inputS, cursor: 'pointer' }} value={w.form.status || 'planned'} onChange={e => setWizard(prev => ({ ...prev, form: { ...prev.form, status: e.target.value } }))}>
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Couleur</label>
                    <input type="color" style={{ ...inputS, height: 42, padding: 4 }} value={w.form.color || '#C9A84C'} onChange={e => setWizard(prev => ({ ...prev, form: { ...prev.form, color: e.target.value } }))} />
                  </div>
                </div>
                {w.template && (
                  <div style={{ marginTop: 16, padding: 14, background: "rgba(27,42,74,0.04)", borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1B2A4A', marginBottom: 8 }}>Modules inclus :</div>
                    {w.template.modules.map((m, i) => <div key={i} style={{ fontSize: 12, color: '#64748B', padding: "4px 0" }}>Jour {i + 1} — {m}</div>)}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Venue */}
            {wizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B2A4A', marginBottom: 16 }}>Choisir un lieu</h3>
                <div style={{ maxHeight: 380, overflow: "auto", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12 }}>
                  {DEFAULT_VENUES.map(v => (
                    <div key={v.id} onClick={() => setWizard(prev => ({ ...prev, venue: prev.venue?.id === v.id ? null : v }))}
                      style={{ display: "grid", gridTemplateColumns: "1.8fr 0.7fr 0.6fr 1fr 1fr 0.5fr", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: w.venue?.id === v.id ? `${ORANGE}12` : "transparent", alignItems: "center" }}>
                      <div><div style={{ fontSize: 13, fontWeight: 600, color: '#1B2A4A' }}>{v.name}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>{v.zone}</div></div>
                      <div style={{ fontSize: 12 }}>{'★'.repeat(v.stars)}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{v.capacity_seminar} p.</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>{fmt(v.tarif_journee)} F/j</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{v.contact_name}</div>
                      <div style={{ textAlign: 'center' as const, fontSize: 18 }}>{w.venue?.id === v.id ? '✅' : '○'}</div>
                    </div>
                  ))}
                </div>
                {w.venue && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(201,168,76,0.08)", borderRadius: 8, fontSize: 13, color: '#1B2A4A' }}>✅ Sélectionné : <strong>{w.venue.name}</strong> — {fmt(w.venue.tarif_journee)} F/jour · {fmt(w.venue.tarif_journee * (w.template?.duration_days || 5))} F total ({w.template?.duration_days || 5}j)</div>}
              </div>
            )}

            {/* Step 4: Speakers */}
            {wizardStep === 4 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B2A4A', marginBottom: 16 }}>Choisir les intervenants</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 360, overflow: "auto" }}>
                  {DEFAULT_SPEAKERS.map(sp => {
                    const sel = w.speakers.some(s => s.id === sp.id);
                    return (
                      <div key={sp.id} onClick={() => setWizard(prev => ({ ...prev, speakers: sel ? prev.speakers.filter(s => s.id !== sp.id) : [...prev.speakers, sp] }))}
                        style={{ padding: 14, borderRadius: 12, border: `2px solid ${sel ? ORANGE : 'rgba(0,0,0,0.1)'}`, background: sel ? `${ORANGE}10` : '#fff', cursor: 'pointer', display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: sel ? `${ORANGE}30` : 'rgba(0,0,0,0.06)', color: sel ? ORANGE : '#94A3B8', display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{sp.avatar_initials}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2A4A' }}>{sp.name}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{sp.title}</div>
                          <div style={{ fontSize: 11, color: ORANGE, fontWeight: 600 }}>{fmt(sp.tarif_journee)} F/j</div>
                          {!sp.disponible && <span style={{ ...badge('#94A3B8'), fontSize: 9, marginTop: 2 }}>Indisponible</span>}
                          {sp.biography && (
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedSpeakerBio(sp); }}
                              style={{ marginTop: 4, padding: "2px 8px", border: `1px solid ${ORANGE}66`, borderRadius: 6, background: 'transparent', color: ORANGE, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Voir profil
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 18 }}>{sel ? '✅' : '○'}</div>
                      </div>
                    );
                  })}
                </div>
                {w.speakers.length > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(201,168,76,0.08)", borderRadius: 8, fontSize: 12, color: '#1B2A4A' }}>
                    {w.speakers.map(s => s.name).join(', ')} — Total : <strong style={{ color: ORANGE }}>{fmt(w.speakers.reduce((sum, s) => sum + s.tarif_journee * (w.template?.duration_days || 5), 0))} F</strong>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Budget */}
            {wizardStep === 5 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B2A4A', marginBottom: 16 }}>Budget & Récapitulatif</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: "rgba(27,42,74,0.04)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>Budget Total</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#1B2A4A' }}>{fmt(wizardBudget.grandTotal)} F</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>dont {fmt(wizardBudget.marketing)} F marketing</div>
                  </div>
                  <div style={{ background: "rgba(39,174,96,0.06)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>Prix de seuil (min {w.form.seats} pax)</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#27AE60' }}>{fmt(wizardBudget.breakeven)} F</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>par participant pour rentabiliser</div>
                  </div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.02)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 14px", background: "#1B2A4A", color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const }}>
                    <div>Poste budgétaire</div><div>Montant (F)</div><div>Ajuster</div>
                  </div>
                  {Object.entries(wizardBudget.b).filter(([k]) => k !== 'commercialisation_pct').map(([k, v]) => (
                    <div key={k} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
                      <div style={{ fontSize: 12 }}>{BUDGET_LABELS[k] || k}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1B2A4A' }}>{fmt(v as number)} F</div>
                      <input type="number" style={{ ...inputS, padding: "6px 10px", fontSize: 12 }} placeholder="Modifier…" onChange={e => { const val = Number(e.target.value); if (val >= 0) setWizard(prev => ({ ...prev, budgetOverrides: { ...prev.budgetOverrides, [k]: val } })); }} />
                    </div>
                  ))}
                </div>
                {/* Pricing section within wizard step 5 */}
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B2A4A', marginBottom: 12, marginTop: 8 }}>💰 Tarification</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={label}>Prix du seminaire</label>
                    <input type="number" style={inputS}
                      value={w.pricing.price ?? Math.ceil(wizardBudget.breakeven * 1.3)}
                      onChange={e => setWizard(prev => ({ ...prev, pricing: { ...prev.pricing, price: Number(e.target.value) } }))} />
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Suggere : {fmt(Math.ceil(wizardBudget.breakeven * 1.3))} F (marge 30%)</div>
                  </div>
                  <div>
                    <label style={label}>Early Bird (%)</label>
                    <input type="number" style={inputS}
                      value={w.pricing.earlyBirdPct ?? prices.discountPct}
                      onChange={e => setWizard(prev => ({ ...prev, pricing: { ...prev.pricing, earlyBirdPct: Number(e.target.value) } }))} />
                  </div>
                  <div>
                    <label style={label}>Coaching (2h)</label>
                    <input type="number" style={inputS}
                      value={w.pricing.coachingPrice ?? prices.coaching}
                      onChange={e => setWizard(prev => ({ ...prev, pricing: { ...prev.pricing, coachingPrice: Number(e.target.value) } }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 13 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1B2A4A' }}>
                    <input type="checkbox" checked={w.pricing.packDiscount3Enabled ?? true}
                      onChange={e => setWizard(prev => ({ ...prev, pricing: { ...prev.pricing, packDiscount3Enabled: e.target.checked } }))} />
                    Pack 3+ ({prices.packDiscount3}%)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1B2A4A' }}>
                    <input type="checkbox" checked={w.pricing.packDiscount2semEnabled ?? true}
                      onChange={e => setWizard(prev => ({ ...prev, pricing: { ...prev.pricing, packDiscount2semEnabled: e.target.checked } }))} />
                    Pack 2 sem ({prices.packDiscount2sem}%)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1B2A4A' }}>
                    <input type="checkbox" checked={w.pricing.packDiscount4semEnabled ?? true}
                      onChange={e => setWizard(prev => ({ ...prev, pricing: { ...prev.pricing, packDiscount4semEnabled: e.target.checked } }))} />
                    Pack 4 sem ({prices.packDiscount4sem}%)
                  </label>
                </div>

                {wizardSaveError && <div style={{ marginBottom: 12, padding: "10px 16px", background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 8, color: "#E74C3C", fontSize: 13 }}>⚠️ {wizardSaveError}</div>}
                {wizardSaveStatus === 'success' && <div style={{ marginBottom: 12, padding: "10px 16px", background: "rgba(39,174,96,0.1)", border: "1px solid rgba(39,174,96,0.3)", borderRadius: 8, color: "#27AE60", fontSize: 13 }}>✅ Séminaire créé avec succès !</div>}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ padding: "0 28px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>
            <button onClick={() => wizardStep > 1 ? setWizardStep(s => (s - 1) as 1 | 2 | 3 | 4 | 5) : (setWizardOpen(false), resetWizard())} style={btnSecondary}>{wizardStep > 1 ? '← Retour' : '✕ Annuler'}</button>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Étape {wizardStep} / 5</div>
            {wizardStep < 5
              ? <button onClick={() => setWizardStep(s => (s + 1) as 1 | 2 | 3 | 4 | 5)} style={btnPrimary}>Suivant →</button>
              : <button onClick={saveWizardSeminar} disabled={wizardSaveStatus === 'saving'} style={{ ...btnPrimary, opacity: wizardSaveStatus === 'saving' ? 0.6 : 1 }}>{wizardSaveStatus === 'saving' ? '⏳ Création…' : '🎓 Créer le séminaire'}</button>
            }
          </div>
        </div>
      </div>
    );
  };

  // ─── Studio Tab Bar ───
  // ─── Pricing helpers ───
  const getPricingForSeminar = (semId: string, semCode: string): SeminarPricing => {
    if (seminarPricing[semId]) return seminarPricing[semId];
    const isS1 = semCode?.toUpperCase() === 'S1';
    return { ...DEFAULT_SEMINAR_PRICING, price: isS1 ? prices.dirigeants : prices.standard, earlyBirdPct: prices.discountPct, coachingPrice: prices.coaching };
  };

  const saveSeminarPricingFor = (semId: string, sp: SeminarPricing) => {
    const updated = { ...seminarPricing, [semId]: sp };
    setSeminarPricing(updated);
    supabase.from('settings').upsert({ id: 'seminar_pricing', value: updated })
      .then(({ error }) => { if (error) console.error('Pricing save failed:', error.message); });
  };

  const resetSeminarPricingFor = (semId: string) => {
    const updated = { ...seminarPricing };
    delete updated[semId];
    setSeminarPricing(updated);
    supabase.from('settings').upsert({ id: 'seminar_pricing', value: updated })
      .then(({ error }) => { if (error) console.error('Pricing reset failed:', error.message); });
  };

  const updPrice = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (k === 'discountPct') {
      setPrices({ ...prices, discountPct: val, earlyBird: prices.standard * (1 - val / 100) });
    } else if (k === 'standard') {
      setPrices({ ...prices, standard: val, earlyBird: val * (1 - prices.discountPct / 100) });
    } else {
      setPrices({ ...prices, [k]: val });
    }
  };

  // ─── Tarification Tab ───
  const renderTarificationTab = () => (
    <div>
      {/* Section A: Global Defaults */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h3 style={{ color: '#1B2A4A', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Tarifs par defaut (globaux)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Standard (S2-S4)</label>
            <input type="number" style={inputS} value={prices.standard} onChange={updPrice('standard')} />
          </div>
          <div>
            <label style={label}>Dirigeants (S1)</label>
            <input type="number" style={inputS} value={prices.dirigeants} onChange={updPrice('dirigeants')} />
          </div>
          <div>
            <label style={label}>Early Bird %</label>
            <input type="number" style={inputS} value={prices.discountPct} onChange={updPrice('discountPct')} />
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>= {fmt(prices.earlyBird)} F</div>
          </div>
          <div>
            <label style={label}>Coaching (2h)</label>
            <input type="number" style={inputS} value={prices.coaching} onChange={updPrice('coaching')} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16, padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 10 }}>
          <div>
            <label style={label}>Pack 3+ employes (%)</label>
            <input type="number" style={inputS} value={prices.packDiscount3} onChange={updPrice('packDiscount3')} />
          </div>
          <div>
            <label style={label}>Pack 2 seminaires (%)</label>
            <input type="number" style={inputS} value={prices.packDiscount2sem} onChange={updPrice('packDiscount2sem')} />
          </div>
          <div>
            <label style={label}>Pack 4 seminaires (%)</label>
            <input type="number" style={inputS} value={prices.packDiscount4sem} onChange={updPrice('packDiscount4sem')} />
          </div>
        </div>
      </div>

      {/* Section B: Per-Seminar Pricing Grid */}
      <div style={card}>
        <h3 style={{ color: '#1B2A4A', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Tarification par seminaire</h3>
        <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.5fr 1.5fr 1fr 0.8fr 0.8fr 0.6fr 0.6fr 0.6fr 0.5fr', padding: '10px 14px', background: '#1B2A4A', color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, gap: 8 }}>
            <div>Code</div><div>Formation</div><div>Prix</div><div>Early Bird</div><div>Coaching</div><div>Pack 3+</div><div>Pack 2</div><div>Pack 4</div><div></div>
          </div>
          {seminars.map(s => {
            const sp = getPricingForSeminar(s.id, s.code);
            const hasOverride = !!seminarPricing[s.id];
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '0.5fr 1.5fr 1fr 0.8fr 0.8fr 0.6fr 0.6fr 0.6fr 0.5fr', padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center', gap: 8, background: hasOverride ? 'rgba(201,168,76,0.05)' : 'transparent' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{s.code}</div>
                <div style={{ fontSize: 12, color: '#1B2A4A', fontWeight: 600 }}>{s.title}</div>
                <div>
                  <input type="number" style={{ ...inputS, padding: '6px 10px', fontSize: 12, fontWeight: hasOverride ? 700 : 400, color: hasOverride ? '#1B2A4A' : '#94A3B8' }}
                    value={sp.price} onChange={e => saveSeminarPricingFor(s.id, { ...sp, price: Number(e.target.value) })} />
                </div>
                <div>
                  <input type="number" style={{ ...inputS, padding: '6px 10px', fontSize: 12, width: 60, fontWeight: hasOverride ? 700 : 400, color: hasOverride ? '#1B2A4A' : '#94A3B8' }}
                    value={sp.earlyBirdPct} onChange={e => saveSeminarPricingFor(s.id, { ...sp, earlyBirdPct: Number(e.target.value) })} />
                </div>
                <div>
                  <input type="number" style={{ ...inputS, padding: '6px 10px', fontSize: 12, fontWeight: hasOverride ? 700 : 400, color: hasOverride ? '#1B2A4A' : '#94A3B8' }}
                    value={sp.coachingPrice} onChange={e => saveSeminarPricingFor(s.id, { ...sp, coachingPrice: Number(e.target.value) })} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={sp.packDiscount3Enabled} onChange={e => saveSeminarPricingFor(s.id, { ...sp, packDiscount3Enabled: e.target.checked })} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={sp.packDiscount2semEnabled} onChange={e => saveSeminarPricingFor(s.id, { ...sp, packDiscount2semEnabled: e.target.checked })} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={sp.packDiscount4semEnabled} onChange={e => saveSeminarPricingFor(s.id, { ...sp, packDiscount4semEnabled: e.target.checked })} />
                </div>
                <div>
                  {hasOverride && (
                    <button onClick={() => resetSeminarPricingFor(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#E74C3C' }} title="Reset aux defaults">↺</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>
          Les valeurs en gris heritent des defaults globaux. Modifiez une valeur pour personnaliser ce seminaire. ↺ pour revenir aux defaults.
        </div>
      </div>
    </div>
  );

  const STUDIO_TABS = [
    { key: 'seminaires', label: '📅 Mes Séminaires', count: seminars.length },
    { key: 'catalogue', label: '📚 Catalogue', count: DEFAULT_FORMATION_TEMPLATES.length },
    { key: 'venues', label: '🏨 Hôtels & Salles', count: localVenues.length },
    { key: 'speakers', label: '🎤 Intervenants', count: localSpeakers.length },
    { key: 'tarification', label: '💰 Tarification', count: seminars.length },
  ] as const;

  return (
    <div>
      {renderWizard()}

      {/* ─── Speaker Bio Modal ─── */}
      {selectedSpeakerBio && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setSelectedSpeakerBio(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ background: '#1B2A4A', borderRadius: '20px 20px 0 0', padding: '24px 28px', display: 'flex', gap: 18, alignItems: 'center', position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${ORANGE}33`, border: `3px solid ${ORANGE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: ORANGE, flexShrink: 0 }}>
                {selectedSpeakerBio.avatar_initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{selectedSpeakerBio.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{selectedSpeakerBio.title}</div>
                <div style={{ fontSize: 11, color: ORANGE, marginTop: 2, fontWeight: 600 }}>{selectedSpeakerBio.company}</div>
              </div>
              <button onClick={() => setSelectedSpeakerBio(null)} style={{ position: 'absolute', top: 16, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Disponibilité + Tarifs */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                <span style={{ ...badge(selectedSpeakerBio.disponible ? '#27AE60' : '#94A3B8'), fontSize: 11 }}>
                  {selectedSpeakerBio.disponible ? '✅ Disponible' : '⏸ Indisponible'}
                </span>
                <span style={{ ...badge(ORANGE), fontSize: 11, color: '#fff' }}>
                  {selectedSpeakerBio.langues.join(' · ')}
                </span>
                <span style={{ background: 'rgba(27,42,74,0.07)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1B2A4A' }}>
                  ½ journée : {fmt(selectedSpeakerBio.tarif_demi_journee)} F
                </span>
                <span style={{ background: 'rgba(27,42,74,0.07)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1B2A4A' }}>
                  Journée : {fmt(selectedSpeakerBio.tarif_journee)} F
                </span>
              </div>

              {/* Expertise tags */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, marginBottom: 8, letterSpacing: 1 }}>Expertises</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                  {selectedSpeakerBio.expertise.map(e => (
                    <span key={e} style={{ background: `${ORANGE}15`, color: ORANGE, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>{e}</span>
                  ))}
                </div>
              </div>

              {/* Biographie */}
              {selectedSpeakerBio.biography && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, marginBottom: 8, letterSpacing: 1 }}>Biographie</div>
                  <p style={{ fontSize: 13, color: '#1B2A4A', lineHeight: 1.7, margin: 0, background: 'rgba(0,0,0,0.025)', borderRadius: 10, padding: '14px 16px' }}>
                    {selectedSpeakerBio.biography}
                  </p>
                </div>
              )}

              {/* Historique formations */}
              {selectedSpeakerBio.formations_history && selectedSpeakerBio.formations_history.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, marginBottom: 8, letterSpacing: 1 }}>Historique des formations</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                    {selectedSpeakerBio.formations_history.map((f, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#1B2A4A', lineHeight: 1.5 }}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Note interne */}
              {selectedSpeakerBio.note && (
                <div style={{ background: 'rgba(201,168,76,0.08)', border: `1px solid ${ORANGE}33`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ORANGE, textTransform: 'uppercase' as const, marginBottom: 4, letterSpacing: 1 }}>Note interne</div>
                  <div style={{ fontSize: 12, color: '#1B2A4A', lineHeight: 1.5 }}>{selectedSpeakerBio.note}</div>
                </div>
              )}

              {/* Contact */}
              <div style={{ display: 'flex', gap: 12, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
                <a href={`mailto:${selectedSpeakerBio.email}`} style={{ fontSize: 12, color: '#1B2A4A', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✉️ {selectedSpeakerBio.email}
                </a>
                <span style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                  📞 {selectedSpeakerBio.phone}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ color: '#1B2A4A', fontSize: 24, fontWeight: 800, margin: 0 }}>Studio de Création de Séminaires</h2>
          <p style={{ color: '#64748B', fontSize: 13, margin: "4px 0 0" }}>Gérez vos formations, hôtels et intervenants. Utilisez le wizard pour créer un nouveau séminaire.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {studioTab === 'seminaires' && !showForm && (
            <button onClick={() => setShowForm(true)} style={{ ...btnSecondary, fontSize: 13 }}>✏️ Modifier existant</button>
          )}
          <button onClick={() => openWizard()} style={btnPrimary}>+ Nouveau Séminaire</button>
        </div>
      </div>

      {/* Studio Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(0,0,0,0.04)", borderRadius: 12, padding: 4 }}>
        {STUDIO_TABS.map(t => (
          <button key={t.key} onClick={() => { setStudioTab(t.key); setShowForm(false); }}
            style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: studioTab === t.key ? 700 : 500, fontSize: 13, background: studioTab === t.key ? "#fff" : "transparent", color: studioTab === t.key ? '#1B2A4A' : '#64748B', boxShadow: studioTab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
            {t.label} <span style={{ fontSize: 11, color: studioTab === t.key ? ORANGE : '#94A3B8', fontWeight: 700 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {studioTab === 'seminaires' && renderSeminairesTab()}
      {studioTab === 'catalogue' && renderCatalogueTab()}
      {studioTab === 'venues' && renderVenuesTab()}
      {studioTab === 'speakers' && renderSpeakersTab()}
      {studioTab === 'tarification' && renderTarificationTab()}
    </div>
  );
}
