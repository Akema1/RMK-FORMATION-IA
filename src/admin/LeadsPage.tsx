import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { card, inputS, selectS, btnPrimary, btnSecondary, badge, label, ORANGE } from './config';
import type { Lead } from './types';

interface LeadsPageProps {
  leads: Lead[];
  refreshLeads: () => Promise<void>;
}

const statusColors: Record<string, string> = { froid: "#94A3B8", tiede: "#3498DB", chaud: "#E67E22", signé: "#27AE60" };

export function LeadsPage({ leads, refreshLeads }: LeadsPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom: "", source: "", status: "froid", notes: "", contact: "" });
  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const saveLead = async () => {
    if (!form.nom) return;
    if (editingId) {
      await supabase.from('leads').update(form).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('leads').insert([form]);
    }
    refreshLeads();
    setForm({ nom: "", source: "", status: "froid", notes: "", contact: "" });
    setShowForm(false);
  };

  const startEdit = (l: Lead) => {
    setForm({ nom: l.nom, source: l.source || "", status: l.status || "froid", notes: l.notes || "", contact: l.contact || "" });
    setEditingId(l.id);
    setShowForm(true);
  };

  const deleteLead = async (id: string) => {
    if (confirm("Supprimer ce prospect ?")) {
      await supabase.from('leads').delete().eq('id', id);
      refreshLeads();
    }
  };

  const exportCSV = () => {
    const headers = ["nom", "entreprise", "contact", "source", "status", "notes", "created_at"];
    const csvContent = [
      headers.join(","),
      ...leads.map(l => headers.map(h => `"${(((l as unknown) as Record<string, unknown>)[h] || "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `leads_rmk_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: 0 }}>CRM Leads & Prospects</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={exportCSV} style={{ ...btnSecondary, borderColor: "#27AE60", color: "#27AE60" }}>Exporter CSV</button>
          <button onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null); }} style={btnPrimary}>{showForm ? "✕ Fermer" : "+ Nouveau Lead"}</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: 24, borderLeft: `3px solid ${ORANGE}` }}>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editingId ? "Modifier le lead" : "Ajouter un lead"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={label}>Nom / Société</label><input style={inputS} value={form.nom} onChange={upd("nom")} /></div>
            <div><label style={label}>Contact (Tel/Email)</label><input style={inputS} value={form.contact} onChange={upd("contact")} /></div>
            <div><label style={label}>Source</label>
              <select style={selectS} value={form.source} onChange={upd("source")}>
                <option value="">-- Choisir --</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Emailing">Emailing</option>
                <option value="Bouche à oreille">Bouche à oreille</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={label}>Statut</label>
            <select style={selectS} value={form.status} onChange={upd("status")}>
              <option value="froid">Froid</option>
              <option value="tiede">Tiède</option>
              <option value="chaud">Chaud</option>
              <option value="signé">Signé</option>
            </select>
          </div>
          <div style={{ marginTop: 12 }}><label style={label}>Notes CRM</label><textarea style={{ ...inputS, height: 80 }} value={form.notes} onChange={upd("notes")} placeholder="Actions..." /></div>
          <button onClick={saveLead} style={{ ...btnPrimary, marginTop: 16 }}>Enregistrer</button>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {leads.map(l => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 3fr auto", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{l.nom}</div>
            <div style={{ fontSize: 12 }}>{l.contact}</div>
            <div><span style={{ ...badge(statusColors[l.status || "froid"]), fontSize: 10 }}>{l.status}</span></div>
            <div style={{ fontSize: 12, color: "#666" }}>{l.notes}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startEdit(l)} style={{ background: "none", border: "none", cursor: "pointer" }}>✏️</button>
              <button onClick={() => deleteLead(l.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
