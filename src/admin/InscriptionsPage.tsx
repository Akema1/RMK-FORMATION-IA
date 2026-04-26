import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabaseClient';
import { fmt } from '../data/seminars';
import { card, inputS, selectS, btnPrimary, btnSecondary, label, ORANGE, ICON_EMOJI } from './config';
import type { Seminar, Participant } from './types';

interface InscriptionsPageProps {
  participants: Participant[];
  seminars: Seminar[];
  refreshParticipants: () => Promise<void>;
}

const statusColors: Record<string, string> = { confirmed: "#27AE60", pending: "#F39C12", cancelled: "#E74C3C" };
const statusLabels: Record<string, string> = { confirmed: "Confirmé", pending: "En attente", cancelled: "Annulé" };

export function InscriptionsPage({ participants, seminars, refreshParticipants }: InscriptionsPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", tel: "", societe: "", fonction: "", seminar: "", amount: 0, status: "pending", payment: "", notes: "" });
  const [filter, setFilter] = useState("all");
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const addParticipant = async () => {
    if (!form.nom || !form.seminar) return;
    // Sprint 7 Phase 4 — normalize email before write so the server-side
    // /api/registration/check-duplicate (LandingPage idempotency guard)
    // can actually find admin-entered rows. Postgres `=` is case-sensitive,
    // so a "John@Example.com" row here would miss a "john@example.com"
    // dupe check and let a public registrant create a second row.
    const normalized = { ...form, email: form.email.trim().toLowerCase(), amount: Number(form.amount) };
    if (editingId) {
      await supabase.from('participants').update(normalized).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('participants').insert([normalized]);
    }
    refreshParticipants();
    setForm({ nom: "", prenom: "", email: "", tel: "", societe: "", fonction: "", seminar: "", amount: 0, status: "pending", payment: "", notes: "" });
    setShowForm(false);
  };

  const startEdit = (p: Participant) => {
    setForm({ nom: p.nom, prenom: p.prenom, email: p.email, tel: p.tel, societe: p.societe, fonction: p.fonction, seminar: p.seminar, amount: p.amount, status: p.status, payment: p.payment, notes: p.notes });
    setEditingId(p.id);
    setShowForm(true);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('participants').update({ status }).eq('id', id);
    refreshParticipants();
  };

  const markPaid = async (id: string) => {
    if (markingPaidId) return;
    const provider = window.prompt(
      "Méthode de paiement (wave / orange_money / bank_transfer / cash) — Annuler pour omettre",
      "wave",
    );
    setMarkingPaidId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        window.alert("Session expirée. Reconnectez-vous puis réessayez.");
        return;
      }
      const res = await fetch(`/api/admin/participants/${id}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(provider ? { payment_provider: provider } : {}),
      });
      if (res.ok) {
        await refreshParticipants();
      } else {
        window.alert("Erreur lors de la confirmation. Réessayez.");
      }
    } catch (err) {
      console.error("[mark-paid] request failed:", err);
      window.alert("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const deleteParticipant = async (id: string) => {
    if (window.confirm("Supprimer définitivement ?")) {
      await supabase.from('participants').delete().eq('id', id);
      refreshParticipants();
    }
  };

  const exportAttestation = (p: Participant, s: Seminar) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const navy: [number, number, number] = [27, 42, 74];
    const gold: [number, number, number] = [201, 168, 76];

    // Navy header band
    doc.setFillColor(...navy);
    doc.rect(0, 0, 297, 50, 'F');

    // Gold accent line
    doc.setFillColor(...gold);
    doc.rect(0, 50, 297, 3, 'F');

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text("ATTESTATION DE FORMATION", 148.5, 28, { align: "center" });
    doc.setFontSize(12);
    doc.setTextColor(...gold);
    doc.text("RMK CONSEILS × CABEXIA", 148.5, 42, { align: "center" });

    // Gold border frame (inner area)
    doc.setLineWidth(1.5);
    doc.setDrawColor(...gold);
    doc.rect(15, 58, 267, 130);

    // Body
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Nous soussignés, certifions que :", 148.5, 82, { align: "center" });

    doc.setFontSize(26);
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.text(`${p.prenom} ${p.nom}`.toUpperCase(), 148.5, 100, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text("a suivi avec succès l'atelier de formation :", 148.5, 118, { align: "center" });

    doc.setFontSize(20);
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.text(`« ${s.title} »`, 148.5, 135, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`${s.week} — Abidjan, Côte d'Ivoire`, 148.5, 150, { align: "center" });
    doc.text("Formation hybride : 3 jours présentiel + 2 sessions en ligne", 148.5, 160, { align: "center" });

    // Signatures
    doc.setLineWidth(0.5);
    doc.setDrawColor(180, 180, 180);
    doc.line(40, 178, 120, 178);
    doc.line(177, 178, 257, 178);

    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.text("Le Directeur Général", 80, 184, { align: "center" });
    doc.text("L'Expert Formateur", 217, 184, { align: "center" });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text("RMK Conseils", 80, 190, { align: "center" });
    doc.text("CABEXIA", 217, 190, { align: "center" });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} — Réf: ATT-${s.code}-${p.nom.substring(0, 3).toUpperCase()}`, 148.5, 205, { align: "center" });

    doc.save(`Attestation_${p.nom}_${s.code}.pdf`);
  };

  const filtered = filter === "all" ? participants : participants.filter(p => p.seminar === filter);

  const exportCSV = () => {
    const headers = ["nom", "prenom", "email", "tel", "societe", "fonction", "seminar", "amount", "status", "payment", "notes", "created_at"];
    const rows = participants.map(p => {
      const s = seminars.find(x => x.id === p.seminar);
      return { ...p, seminar: s ? s.code : p.seminar };
    });
    const csvContent = [
      headers.join(","),
      ...rows.map(r => headers.map(h => `"${((r as Record<string, unknown>)[h] || "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `inscriptions_rmk_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: 0 }}>Gestion des inscriptions</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={exportCSV} style={{ ...btnSecondary, borderColor: "#27AE60", color: "#27AE60" }}>Exporter CSV</button>
          <button onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null); }} style={btnPrimary}>{showForm ? "✕ Fermer" : "+ Nouvelle inscription"}</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: 24, borderLeft: `3px solid ${ORANGE}` }}>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editingId ? "Modifier l'inscription" : "Ajouter un participant"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={label}>Nom *</label><input style={inputS} value={form.nom} onChange={upd("nom")} placeholder="Nom" /></div>
            <div><label style={label}>Prénom</label><input style={inputS} value={form.prenom} onChange={upd("prenom")} placeholder="Prénom" /></div>
            <div><label style={label}>Email</label><input style={inputS} value={form.email} onChange={upd("email")} placeholder="email@entreprise.com" /></div>
            <div><label style={label}>Téléphone</label><input style={inputS} value={form.tel} onChange={upd("tel")} placeholder="+225 07..." /></div>
            <div><label style={label}>Société</label><input style={inputS} value={form.societe} onChange={upd("societe")} placeholder="Nom entreprise" /></div>
            <div><label style={label}>Fonction</label><input style={inputS} value={form.fonction} onChange={upd("fonction")} placeholder="Directeur, DAF..." /></div>
            <div><label style={label}>Atelier *</label>
              <select style={selectS} value={form.seminar} onChange={upd("seminar")}>
                <option value="">-- Choisir --</option>
                {seminars.map(s => <option key={s.id} value={s.id}>{s.code} – {s.title}</option>)}
              </select>
            </div>
            <div><label style={label}>Montant payé (FCFA)</label><input type="number" style={inputS} value={form.amount} onChange={upd("amount")} /></div>
            <div><label style={label}>Mode de paiement</label>
              <select style={selectS} value={form.payment} onChange={upd("payment")}>
                <option value="">-- Mode --</option>
                <option value="virement">Virement bancaire</option>
                <option value="orange">Orange Money</option>
                <option value="mtn">MTN MoMo</option>
                <option value="wave">Wave</option>
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
              </select>
            </div>
            <div><label style={label}>Statut</label>
              <select style={selectS} value={form.status} onChange={upd("status")}>
                <option value="pending">En attente</option>
                <option value="confirmed">Confirmé</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}><label style={label}>Notes</label><input style={inputS} value={form.notes || ""} onChange={upd("notes")} placeholder="Notes internes..." /></div>
          <button onClick={addParticipant} style={{ ...btnPrimary, marginTop: 16 }}>{editingId ? "Enregistrer les modifications" : "Enregistrer l'inscription"}</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("all")} style={{ ...btnSecondary, background: filter === "all" ? `${ORANGE}22` : undefined, color: filter === "all" ? ORANGE : "rgba(0,0,0,0.5)" }}>Tous ({participants.length})</button>
        {seminars.map(s => {
          const c = participants.filter(p => p.seminar === s.id).length;
          return <button key={s.id} onClick={() => setFilter(s.id)} style={{ ...btnSecondary, background: filter === s.id ? `${s.color}22` : undefined, color: filter === s.id ? s.color : "rgba(0,0,0,0.5)", borderColor: filter === s.id ? `${s.color}44` : undefined }}>{s.code} ({c})</button>;
        })}
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.6fr 0.9fr 1fr 0.9fr 1fr 0.8fr 1fr 0.9fr 1.2fr", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          {["Participant", "Société / Fonction", "Atelier", "Paiement", "Montant", "Statut", "Canal", "Réf. paiement", "Paiement", "Actions"].map(h => (
            <div key={h} style={{ fontSize: 10, color: '#1B2A4A', textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{h}</div>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: '#1B2A4A', fontSize: 14 }}>Aucune inscription pour le moment</div>}
        {filtered.map(p => {
          const s = seminars.find(x => x.id === p.seminar);
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.6fr 0.9fr 1fr 0.9fr 1fr 0.8fr 1fr 0.9fr 1.2fr", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
              <div><div style={{ color: "#1B2A4A", fontSize: 13, fontWeight: 600 }}>{p.nom} {p.prenom}</div><div style={{ color: '#1B2A4A', fontSize: 11 }}>{p.email}</div></div>
              <div><div style={{ color: '#1B2A4A', fontSize: 13 }}>{p.societe}</div><div style={{ color: '#1B2A4A', fontSize: 11 }}>{p.fonction}</div></div>
              <div style={{ fontSize: 12, color: s?.color || "#fff", fontWeight: 600 }}>{s?.code} {ICON_EMOJI[s?.icon || ""] || "📋"}</div>
              <div style={{ fontSize: 12, color: '#1B2A4A', display: "flex", alignItems: "center", gap: 8 }}>
                {p.payment || "—"}
                {p.tel && (
                  <a href={`https://wa.me/${p.tel.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: "#25D366", textDecoration: "none", display: "flex", alignItems: "center", background: "rgba(37, 211, 102, 0.1)", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    WhatsApp
                  </a>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#1B2A4A", fontWeight: 600 }}>{fmt(p.amount)} F</div>
              <div>
                <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)} style={{ background: `${statusColors[p.status]}22`, color: statusColors[p.status], border: "none", borderRadius: 100, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  <option value="pending">En attente</option>
                  <option value="confirmed">Confirmé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
              <div style={{ fontSize: 12, color: '#1B2A4A' }}>{p.referral_channel ?? "—"}</div>
              <div style={{ fontFamily: "Menlo, monospace", fontSize: 11, color: '#1B2A4A' }}>
                {p.payment_reference ?? "—"}
              </div>
              <div>
                <span style={{
                  padding: "3px 8px", borderRadius: 999, fontSize: 11,
                  background: p.payment === "paid" ? "rgba(34,139,34,0.12)" : "rgba(180,180,180,0.12)",
                  color: p.payment === "paid" ? "#228B22" : "#666",
                  fontWeight: 600,
                }}>
                  {p.payment === "paid" ? "Payé" : "—"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {!(p.status === "confirmed" && p.payment === "paid") && (
                  <button
                    onClick={() => markPaid(p.id)}
                    disabled={markingPaidId !== null}
                    style={{
                      background: "#C9A84C", color: "#1B2A4A", border: 0,
                      padding: "5px 10px", borderRadius: 6, fontSize: 11,
                      fontWeight: 700,
                      cursor: markingPaidId !== null ? "not-allowed" : "pointer",
                      opacity: markingPaidId !== null ? 0.55 : 1,
                    }}
                    title="Marquer payé et envoyer email de bienvenue"
                  >
                    {markingPaidId === p.id ? "Envoi…" : "Marquer payé"}
                  </button>
                )}
                <button onClick={() => startEdit(p)} style={{ background: "none", border: "none", color: ORANGE, cursor: "pointer", fontSize: 16 }} title="Modifier">✏️</button>
                {p.status === "confirmed" && s && (
                  <button onClick={() => exportAttestation(p, s)} style={{ background: "none", border: "none", color: "#3498DB", cursor: "pointer", fontSize: 16 }} title="Exporter Attestation">🎓</button>
                )}
                <button onClick={() => deleteParticipant(p.id)} style={{ background: "none", border: "none", color: "#E74C3C", cursor: "pointer", fontSize: 16 }} title="Supprimer">🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
