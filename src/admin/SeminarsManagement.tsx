import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { card, inputS, selectS, btnPrimary, label, ORANGE, ICON_EMOJI } from './config';
import type { Seminar } from './types';

interface SeminarsManagementProps {
  seminars: Seminar[];
  refreshSeminars: () => Promise<void>;
}

export function SeminarsManagement({ seminars, refreshSeminars }: SeminarsManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Seminar>>({ code: "", title: "", week: "", icon: "\uD83D\uDCDA", color: "#C9A84C", seats: 20 });

  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const saveSeminar = async () => {
    if (!form.code || !form.title) return;

    const payload = {
      ...form,
      targets: typeof form.targets === 'string' ? (form.targets as string).split(',').map(s => s.trim()).filter(Boolean) : form.targets,
      sectors: typeof form.sectors === 'string' ? (form.sectors as string).split(',').map(s => s.trim()).filter(Boolean) : form.sectors,
      flyer_bullets: typeof form.flyer_bullets === 'string' ? (form.flyer_bullets as string).split(',').map(s => s.trim()).filter(Boolean) : form.flyer_bullets,
      seats: Number(form.seats)
    };

    if (editingId) {
      await supabase.from('seminars').update(payload).eq('id', editingId);
    } else {
      await supabase.from('seminars').insert([payload]);
    }
    setEditingId(null);
    setShowForm(false);
    setForm({ code: "", title: "", week: "", icon: "\uD83D\uDCDA", color: "#C9A84C", seats: 20 });
    refreshSeminars();
  };

  const startEdit = (s: Seminar) => {
    setForm(s);
    setEditingId(s.id);
    setShowForm(true);
  };

  const deleteSeminar = async (id: string) => {
    if (confirm("Supprimer ce séminaire ?")) {
      await supabase.from('seminars').delete().eq('id', id);
      refreshSeminars();
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: 0 }}>Gestion des Séminaires</h2>
        <button onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null); }} style={btnPrimary}>{showForm ? "✕ Fermer" : "+ Nouveau Séminaire"}</button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: 24, borderLeft: `3px solid ${ORANGE}` }}>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editingId ? "Modifier le séminaire" : "Ajouter un séminaire"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={label}>Code (ex: S1)</label><input style={inputS} value={form.code} onChange={upd("code")} /></div>
            <div><label style={label}>Titre</label><input style={inputS} value={form.title} onChange={upd("title")} /></div>
            <div><label style={label}>Libellé dates (ex: 19 – 23 Mai 2026)</label><input style={inputS} value={form.week} onChange={upd("week")} /></div>
            <div><label style={label}>Date début</label><input type="date" style={inputS} value={form.dates?.start || ""} onChange={(e) => setForm({ ...form, dates: { ...form.dates, start: e.target.value } as any })} /></div>
            <div><label style={label}>Places Disponibles</label><input type="number" style={inputS} value={form.seats} onChange={upd("seats")} /></div>
            <div><label style={label}>Icon</label>
              <select style={{ ...inputS, cursor: "pointer" }} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                <option value="Briefcase">💼 Briefcase</option>
                <option value="BarChart3">📊 BarChart3</option>
                <option value="Scale">⚖️ Scale</option>
                <option value="Users">👥 Users</option>
              </select>
            </div>
            <div><label style={label}>Couleur (Hex)</label><input type="color" style={{ ...inputS, height: 42, padding: 4, cursor: "pointer" }} value={form.color} onChange={upd("color")} /></div>
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, color: ORANGE, fontWeight: 700, marginBottom: 12 }}>Détails Flyer & Marketing</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={label}>Sous-titre Flyer</label><input style={inputS} value={form.flyer_subtitle} onChange={upd("flyer_subtitle")} placeholder="Ex: IAG Stratégique..." /></div>
              <div><label style={label}>Image Flyer (URL)</label><input style={inputS} value={form.flyer_image} onChange={upd("flyer_image")} placeholder="https://..." /></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={label}>Highlight (Accroche)</label>
              <textarea style={{ ...inputS, height: 60 }} value={form.flyer_highlight} onChange={upd("flyer_highlight")} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <div><label style={label}>Points clés (séparés par des virgules)</label><textarea style={{ ...inputS, height: 80 }} value={Array.isArray(form.flyer_bullets) ? form.flyer_bullets.join(', ') : form.flyer_bullets} onChange={upd("flyer_bullets")} /></div>
              <div><label style={label}>Cibles (séparées par des virgules)</label><textarea style={{ ...inputS, height: 80 }} value={Array.isArray(form.targets) ? form.targets.join(', ') : form.targets} onChange={upd("targets")} /></div>
              <div><label style={label}>Secteurs (séparés par des virgules)</label><textarea style={{ ...inputS, height: 80 }} value={Array.isArray(form.sectors) ? form.sectors.join(', ') : form.sectors} onChange={upd("sectors")} /></div>
            </div>
          </div>
          <button onClick={saveSeminar} style={{ ...btnPrimary, marginTop: 16 }}>Enregistrer</button>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.5fr 3fr 2fr 1fr 1fr", padding: "12px 16px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.4)", textTransform: "uppercase" }}>
          <div>Code</div><div>Titre</div><div>Dates</div><div>Places</div><div>Actions</div>
        </div>
        {seminars.map((s: Seminar) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "0.5fr 3fr 2fr 1fr 1fr", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: s.color }}>{s.code}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{ICON_EMOJI[s.icon] || "📋"} {s.title}</div>
            <div style={{ fontSize: 12 }}>{s.week}</div>
            <div style={{ fontSize: 12 }}>{s.seats} places</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startEdit(s)} style={{ background: "none", border: "none", cursor: "pointer" }}>✏️</button>
              <button onClick={() => deleteSeminar(s.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
