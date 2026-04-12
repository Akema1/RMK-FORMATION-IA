import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { fmt } from '../data/seminars';
import { card, inputS, selectS, btnPrimary, btnSecondary, label, ORANGE, EXPENSE_CATEGORIES } from './config';
import type { Seminar, Participant, Expense, BudgetConfig, Prices, Charges, FinancialResult } from './types';

// ─── Props ───
interface FinancePageProps {
  participants: Participant[];
  seminars: Seminar[];
  prices: Prices;
  expenses: Expense[];
  refreshExpenses: () => Promise<void>;
  budgetConfig: BudgetConfig;
  setBudgetConfig: (config: BudgetConfig) => void;
}

interface ExpenseManagerProps {
  expenses: Expense[];
  seminars: Seminar[];
  refreshExpenses: () => Promise<void>;
  budgetConfig: BudgetConfig;
  setBudgetConfig: (config: BudgetConfig) => void;
}

// ─── ExpenseManager (extracted from closure) ───
function ExpenseManager({ expenses, seminars, refreshExpenses, budgetConfig, setBudgetConfig }: ExpenseManagerProps) {
  const [form, setForm] = useState({ label: "", amount: 0, category: "consultance_pres", seminar: "all", paid: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", amount: 0, category: "", seminar: "", paid: false });

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalPaid = expenses.filter(e => e.paid).reduce((s, e) => s + (e.amount || 0), 0);
  const totalPending = totalExpenses - totalPaid;

  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const updEdit = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEditForm({ ...editForm, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const saveExpense = async () => {
    if (!form.label || !form.amount) return;
    await supabase.from('expenses').insert([{ ...form, amount: Number(form.amount) }]);
    refreshExpenses();
    setForm({ label: "", amount: 0, category: "consultance_pres", seminar: "all", paid: false });
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setEditForm({ label: e.label, amount: e.amount, category: e.category, seminar: e.seminar, paid: e.paid });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.label || !editForm.amount) return;
    await supabase.from('expenses').update({ ...editForm, amount: Number(editForm.amount) }).eq('id', id);
    setEditingId(null);
    refreshExpenses();
  };

  const togglePaidStatus = async (e: Expense) => {
    await supabase.from('expenses').update({ paid: !e.paid }).eq('id', e.id);
    refreshExpenses();
  };

  const cancelEdit = () => { setEditingId(null); };

  const deleteExpense = async (id: string) => {
    if (window.confirm("Supprimer définitivement ?")) {
      await supabase.from('expenses').delete().eq('id', id);
      refreshExpenses();
    }
  };

  const [showBudgetConfig, setShowBudgetConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState<BudgetConfig>(budgetConfig);

  const saveBudgetConfig = async () => {
    setBudgetConfig(tempConfig);
    await supabase.from('settings').upsert({ id: 'budget_config', value: tempConfig });
    setShowBudgetConfig(false);
  };

  return (
    <div style={{ marginTop: 32 }}>
      {/* Budget Settings */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowBudgetConfig(!showBudgetConfig)} style={{ background: "rgba(0,0,0,0.05)", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Configuration du budget standard
        </button>
      </div>

      {showBudgetConfig && (
        <div style={{ ...card, marginBottom: 24, background: "#fff", border: "2px solid rgba(201,168,76,0.5)" }}>
          <h4 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Ajuster le modèle prévisionnel</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {Object.keys(tempConfig).map(k => (
              <div key={k}>
                <label style={label}>{k.replace("_", " ")}</label>
                <input type="number" step={k.includes('pct') ? "0.01" : "1"} style={inputS} value={tempConfig[k]} onChange={e => setTempConfig({ ...tempConfig, [k]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowBudgetConfig(false)} style={{ ...btnSecondary, background: "transparent" }}>Annuler</button>
            <button onClick={saveBudgetConfig} style={btnPrimary}>Enregistrer les paramètres</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color: "#1B2A4A", fontSize: 20, fontWeight: 800, margin: 0 }}>Gestion des Dépenses</h3>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ background: "rgba(39, 174, 96, 0.1)", color: "#27AE60", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            Payé : {fmt(totalPaid)} F
          </div>
          <div style={{ background: "rgba(243, 156, 18, 0.1)", color: "#E67E22", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            À Payer : {fmt(totalPending)} F
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
          <div><label style={label}>Nouvelle Dépense *</label><input style={inputS} value={form.label} onChange={upd("label")} placeholder="Ex: Achat fournitures..." /></div>
          <div><label style={label}>Montant (FCFA) *</label><input type="number" style={inputS} value={form.amount} onChange={upd("amount")} /></div>
          <div><label style={label}>Catégorie Exacte</label>
            <select style={selectS} value={form.category} onChange={upd("category")}>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div><label style={label}>Affectation</label>
            <select style={selectS} value={form.seminar} onChange={upd("seminar")}>
              <option value="all">Tous (Frais Généraux)</option>
              {seminars.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#1B2A4A", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              <input type="checkbox" checked={form.paid} onChange={upd("paid")} /> Payé
            </label>
          </div>
          <button onClick={saveExpense} style={{ ...btnPrimary, height: 42 }}>+ Ajouter</button>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr", padding: "12px 16px", background: "#1B2A4A", color: "#fff", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
          <div>Libellé</div><div>Montant</div><div>Catégorie</div><div>Affectation</div><div style={{ textAlign: "right" }}>Actions</div>
        </div>
        {expenses.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Aucune dépense enregistrée.</div>
        ) : expenses.map(e => (
          editingId === e.id ? (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center", gap: 12, background: "rgba(201,168,76,0.05)" }}>
              <input style={{ ...inputS, padding: "8px 12px" }} value={editForm.label} onChange={updEdit("label")} />
              <input type="number" style={{ ...inputS, padding: "8px 12px" }} value={editForm.amount} onChange={updEdit("amount")} />
              <select style={{ ...selectS, padding: "8px 12px" }} value={editForm.category} onChange={updEdit("category")}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select style={{ ...selectS, padding: "8px 12px" }} value={editForm.seminar} onChange={updEdit("seminar")}>
                <option value="all">Tous (Général)</option>
                {seminars.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => saveEdit(e.id)} style={{ background: "#27AE60", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                <button onClick={cancelEdit} style={{ background: "#E74C3C", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center", transition: "background 0.2s" }} onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,0,0,0.02)"} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
              <div style={{ color: "#1B2A4A", fontSize: 13, fontWeight: 600 }}>{e.label}</div>
              <div style={{ color: "#E74C3C", fontSize: 13, fontWeight: 700 }}>{fmt(e.amount)} F</div>
              <div style={{ color: '#1B2A4A', fontSize: 12, display: "flex", alignItems: "center" }}>
                <span style={{ padding: "4px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 4 }}>
                  {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                </span>
              </div>
              <div style={{ color: '#1B2A4A', fontSize: 12, fontWeight: 500 }}>{e.seminar === "all" ? "Général" : seminars.find(s => s.id === e.seminar)?.code}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                <button onClick={() => togglePaidStatus(e)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }} title={e.paid ? "Marquer comme en attente" : "Marquer comme payé"}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: e.paid ? "#27AE60" : "#E67E22", background: e.paid ? "rgba(39, 174, 96, 0.15)" : "rgba(243, 156, 18, 0.15)", padding: "4px 8px", borderRadius: 100, border: `1px solid ${e.paid ? "rgba(39,174,96,0.3)" : "rgba(243,156,18,0.3)"}` }}>
                    {e.paid ? "✔ Payé" : "⏳ En attente"}
                  </span>
                </button>
                <button onClick={() => startEdit(e)} style={{ background: "none", border: "none", color: "rgba(0,0,0,0.4)", cursor: "pointer", fontSize: 14 }} title="Modifier">✏️</button>
                <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", color: "#E74C3C", cursor: "pointer", fontSize: 16 }} title="Supprimer">🗑</button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ─── FinancePage ───
export function FinancePage({ participants, seminars, prices, expenses, refreshExpenses, budgetConfig, setBudgetConfig }: FinancePageProps) {
  const [view, setView] = useState("global");
  const confirmed = participants.filter(p => p.status === "confirmed");

  const calculateFinancials = (seminarId: string, isPlan: boolean): FinancialResult => {
    let qtyStandard = 0;
    let qtyEarlyBird = 0;
    let totalPax = 0;

    if (isPlan) {
      qtyStandard = 10;
      qtyEarlyBird = 5;
      totalPax = 15;
    } else {
      const semParticipants = seminarId === "global" ? confirmed : confirmed.filter(p => p.seminar === seminarId);
      qtyStandard = semParticipants.filter(p => p.amount >= prices.standard).length;
      qtyEarlyBird = semParticipants.filter(p => p.amount < prices.standard).length;
      totalPax = semParticipants.length;
    }

    const revStandard = qtyStandard * prices.standard;
    const revEarlyBird = qtyEarlyBird * prices.earlyBird;
    const totalRevenus = revStandard + revEarlyBird;

    let charges: Charges = {
      consultance_pres: 0, consultance_ligne: 0, billet_avion: 0, sejour: 0,
      salle: 0, pauses_cafe: 0, dejeuner: 0, supports: 0,
      equipements: 0, divers: 0, transport: 0, commercialisation: 0,
    };

    if (isPlan) {
      charges = {
        consultance_pres: budgetConfig.consultance_pres,
        consultance_ligne: budgetConfig.consultance_ligne,
        billet_avion: budgetConfig.billet_avion,
        sejour: budgetConfig.sejour,
        salle: budgetConfig.salle,
        pauses_cafe: budgetConfig.pauses_cafe,
        dejeuner: budgetConfig.dejeuner,
        supports: budgetConfig.supports,
        equipements: budgetConfig.equipements,
        divers: budgetConfig.divers,
        transport: budgetConfig.transport,
        commercialisation: totalRevenus * budgetConfig.commercialisation_pct,
      };
    } else {
      const semExpenses = seminarId === "global" ? expenses : expenses.filter(e => e.seminar === seminarId || e.seminar === "all");
      semExpenses.forEach(e => {
        if (e.category === "formateur") charges.consultance_pres += e.amount;
        if (e.category === "transport") charges.billet_avion += e.amount;
        if (e.category === "hebergement") charges.sejour += e.amount;
        if (e.category === "salle") charges.salle += e.amount;
        if (e.category === "restauration") charges.dejeuner += e.amount;
        if (e.category === "supports") charges.supports += e.amount;
        if (e.category === "marketing") charges.commercialisation += e.amount;
        if (e.category === "divers") charges.divers += e.amount;
      });
    }

    const totalCharges = Object.values(charges).reduce((a, b) => a + b, 0);
    const revenuProv = totalRevenus - totalCharges;
    const imprevu = revenuProv > 0 ? revenuProv * 0.1 : 0;
    const sousTotalBrut = revenuProv - imprevu;
    const tva = sousTotalBrut > 0 ? sousTotalBrut * 0.18 : 0;
    const net = sousTotalBrut - tva;

    return { qtyStandard, qtyEarlyBird, totalPax, revStandard, revEarlyBird, totalRevenus, charges, totalCharges, revenuProv, imprevu, sousTotalBrut, tva, net };
  };

  let plan = calculateFinancials(view, true);
  let actual = calculateFinancials(view, false);

  if (view === "global") {
    const semPlans = seminars.map(s => calculateFinancials(s.id, true));
    plan = {
      qtyStandard: semPlans.reduce((s, p) => s + p.qtyStandard, 0),
      qtyEarlyBird: semPlans.reduce((s, p) => s + p.qtyEarlyBird, 0),
      totalPax: semPlans.reduce((s, p) => s + p.totalPax, 0),
      revStandard: semPlans.reduce((s, p) => s + p.revStandard, 0),
      revEarlyBird: semPlans.reduce((s, p) => s + p.revEarlyBird, 0),
      totalRevenus: semPlans.reduce((s, p) => s + p.totalRevenus, 0),
      charges: {
        consultance_pres: semPlans.reduce((s, p) => s + p.charges.consultance_pres, 0),
        consultance_ligne: semPlans.reduce((s, p) => s + p.charges.consultance_ligne, 0),
        billet_avion: semPlans[0]?.charges.billet_avion || 0,
        sejour: semPlans.reduce((s, p) => s + p.charges.sejour, 0),
        salle: semPlans.reduce((s, p) => s + p.charges.salle, 0),
        pauses_cafe: semPlans.reduce((s, p) => s + p.charges.pauses_cafe, 0),
        dejeuner: semPlans.reduce((s, p) => s + p.charges.dejeuner, 0),
        supports: semPlans.reduce((s, p) => s + p.charges.supports, 0),
        equipements: semPlans.reduce((s, p) => s + p.charges.equipements, 0),
        divers: semPlans.reduce((s, p) => s + p.charges.divers, 0),
        transport: semPlans[0]?.charges.transport || 0,
        commercialisation: semPlans.reduce((s, p) => s + p.charges.commercialisation, 0),
      },
      totalCharges: semPlans.reduce((s, p) => s + p.totalCharges, 0),
      revenuProv: semPlans.reduce((s, p) => s + p.revenuProv, 0),
      imprevu: semPlans.reduce((s, p) => s + p.imprevu, 0),
      sousTotalBrut: semPlans.reduce((s, p) => s + p.sousTotalBrut, 0),
      tva: semPlans.reduce((s, p) => s + p.tva, 0),
      net: semPlans.reduce((s, p) => s + p.net, 0),
    };
  }

  const exportPDF = () => {
    const doc = new jsPDF();
    const title = view === "global" ? "Tous les séminaires" : seminars.find(s => s.id === view)?.title || "Séminaire";
    const brandNavy: [number, number, number] = [27, 42, 74];
    const brandGold: [number, number, number] = [201, 168, 76];
    const brandLight: [number, number, number] = [245, 240, 232];

    doc.setFillColor(...brandNavy);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text("RAPPORT FINANCIER", 14, 22);
    doc.setTextColor(...brandGold);
    doc.setFontSize(12);
    doc.text(title.toUpperCase(), 14, 32);
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.setFont('helvetica', 'normal');
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 155, 22);
    doc.text("RMK CONSEILS", 155, 32);

    doc.setTextColor(...brandNavy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("1. Synthèse Globale", 14, 60);

    autoTable(doc, {
      startY: 65,
      head: [['Indicateur', 'Plan (Budget)', 'Réel (Actuel)', 'Écart']],
      body: [
        ['Revenus (Standard)', fmt(plan.revStandard), fmt(actual.revStandard), fmt(actual.revStandard - plan.revStandard)],
        ['Revenus (Early Bird)', fmt(plan.revEarlyBird), fmt(actual.revEarlyBird), fmt(actual.revEarlyBird - plan.revEarlyBird)],
        ['TOTAL REVENUS', fmt(plan.totalRevenus), fmt(actual.totalRevenus), fmt(actual.totalRevenus - plan.totalRevenus)],
        ['TOTAL CHARGES', fmt(plan.totalCharges), fmt(actual.totalCharges), fmt(plan.totalCharges - actual.totalCharges)],
        ['BÉNÉFICE NET', fmt(plan.net), fmt(actual.net), fmt(actual.net - plan.net)],
      ],
      headStyles: { fillColor: brandNavy, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      bodyStyles: { textColor: brandNavy, fontSize: 11 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right', textColor: brandGold, fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: brandLight },
      theme: 'grid'
    });

    let finalY = ((doc as unknown) as Record<string, Record<string, unknown>>).lastAutoTable.finalY as number + 20;
    doc.setTextColor(...brandNavy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("2. Détails des Dépenses", 14, finalY);

    const chargesDiff = (p: number, a: number) => fmt(p - a);
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Catégorie de Dépense', 'Budget (Plan)', 'Réel (Dépenses)', 'Écart']],
      body: [
        ['Consultance (Présentiel)', fmt(plan.charges.consultance_pres || 0), fmt(actual.charges.consultance_pres || 0), chargesDiff(plan.charges.consultance_pres || 0, actual.charges.consultance_pres || 0)],
        ['Consultance (Ligne)', fmt(plan.charges.consultance_ligne || 0), fmt(actual.charges.consultance_ligne || 0), chargesDiff(plan.charges.consultance_ligne || 0, actual.charges.consultance_ligne || 0)],
        ["Billet d'avion", fmt(plan.charges.billet_avion || 0), fmt(actual.charges.billet_avion || 0), chargesDiff(plan.charges.billet_avion || 0, actual.charges.billet_avion || 0)],
        ['Hébergement / Séjour', fmt(plan.charges.sejour || 0), fmt(actual.charges.sejour || 0), chargesDiff(plan.charges.sejour || 0, actual.charges.sejour || 0)],
        ['Location Salle', fmt(plan.charges.salle || 0), fmt(actual.charges.salle || 0), chargesDiff(plan.charges.salle || 0, actual.charges.salle || 0)],
        ['Pauses Café', fmt(plan.charges.pauses_cafe || 0), fmt(actual.charges.pauses_cafe || 0), chargesDiff(plan.charges.pauses_cafe || 0, actual.charges.pauses_cafe || 0)],
        ['Déjeuners', fmt(plan.charges.dejeuner || 0), fmt(actual.charges.dejeuner || 0), chargesDiff(plan.charges.dejeuner || 0, actual.charges.dejeuner || 0)],
        ['Supports Pédagogiques', fmt(plan.charges.supports || 0), fmt(actual.charges.supports || 0), chargesDiff(plan.charges.supports || 0, actual.charges.supports || 0)],
        ['Équipements', fmt(plan.charges.equipements || 0), fmt(actual.charges.equipements || 0), chargesDiff(plan.charges.equipements || 0, actual.charges.equipements || 0)],
        ['Communication / Mkt', fmt(plan.charges.commercialisation || 0), fmt(actual.charges.commercialisation || 0), chargesDiff(plan.charges.commercialisation || 0, actual.charges.commercialisation || 0)],
        ['Transport local', fmt(plan.charges.transport || 0), fmt(actual.charges.transport || 0), chargesDiff(plan.charges.transport || 0, actual.charges.transport || 0)],
        ['Divers & Imprévus', fmt(plan.charges.divers || 0), fmt(actual.charges.divers || 0), chargesDiff(plan.charges.divers || 0, actual.charges.divers || 0)],
      ],
      headStyles: { fillColor: brandNavy, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: brandNavy, fontSize: 10 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' } },
      alternateRowStyles: { fillColor: brandLight },
      theme: 'grid',
    });

    const pageCount = ((doc as unknown) as Record<string, Record<string, unknown>>).internal.getNumberOfPages as () => number;
    const pages = pageCount();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`RMK CONSEILS - Document Confidentiel - Page ${i} sur ${pages}`, 14, 290);
    }

    doc.save(`RMK_Finance_${view}.pdf`);
  };

  const chartData = [
    { name: 'Revenus', Plan: plan.totalRevenus, Réel: actual.totalRevenus },
    { name: 'Charges', Plan: plan.totalCharges, Réel: actual.totalCharges },
    { name: 'Bénéfice Net', Plan: plan.net, Réel: actual.net },
  ];

  const chargeRows = [
    { label: "Consultance (Présentiel)", key: "consultance_pres" },
    { label: "Consultance (Ligne)", key: "consultance_ligne" },
    { label: "Billet d'avion", key: "billet_avion" },
    { label: "Hébergement / Séjour", key: "sejour" },
    { label: "Location Salle", key: "salle" },
    { label: "Pauses Café", key: "pauses_cafe" },
    { label: "Déjeuners", key: "dejeuner" },
    { label: "Supports Pédagogiques", key: "supports" },
    { label: "Équipements", key: "equipements" },
    { label: "Communication / Mkt", key: "commercialisation" },
    { label: "Transport local", key: "transport" },
    { label: "Divers & Imprévus", key: "divers" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: 0 }}>Gestion Financière</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportPDF} style={{ ...btnPrimary, background: "#27AE60", marginRight: 16 }}>Exporter PDF</button>
          <button onClick={() => setView("global")} style={{ ...btnSecondary, background: view === "global" ? `${ORANGE}22` : undefined, color: view === "global" ? ORANGE : "rgba(0,0,0,0.5)" }}>Vue Globale</button>
          {seminars.map(s => (
            <button key={s.id} onClick={() => setView(s.id)} style={{ ...btnSecondary, background: view === s.id ? `${s.color}22` : undefined, color: view === s.id ? s.color : "rgba(0,0,0,0.5)" }}>{s.code}</button>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 24, height: 300 }}>
        <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Comparatif Plan vs Réel ({view === "global" ? "Tous les séminaires" : seminars.find(s => s.id === view)?.title})</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
            <XAxis dataKey="name" stroke="rgba(0,0,0,0.5)" />
            <YAxis stroke="rgba(0,0,0,0.5)" tickFormatter={(value) => `${value / 1000000}M`} />
            <Tooltip formatter={(value: number) => `${fmt(value)} FCFA`} contentStyle={{ backgroundColor: '#1B2A4A', borderColor: 'rgba(0,0,0,0.1)', color: '#1B2A4A' }} />
            <Legend />
            <Bar dataKey="Plan" fill="#2980B9" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Réel" fill="#C9A84C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 32 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "#1B2A4A" }}>Catégorie de Dépense</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: "#2980B9" }}>Budget (Plan)</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: "#C9A84C" }}>Réel (Dépenses)</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: "#1B2A4A" }}>Écart</th>
            </tr>
          </thead>
          <tbody>
            {chargeRows.map((row, i) => {
              const pVal = plan.charges[row.key] || 0;
              const aVal = actual.charges[row.key] || 0;
              const diff = pVal - aVal;
              const configKey = row.key as keyof typeof budgetConfig;
              const isEditable = configKey in budgetConfig && configKey !== "commercialisation_pct";
              return (
                <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <td style={{ padding: "10px 16px", color: "#1B2A4A", fontWeight: 500 }}>{row.label}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#2980B9" }}>
                    {isEditable ? (
                      <input
                        type="number"
                        value={budgetConfig[configKey] || 0}
                        onChange={(e) => setBudgetConfig({ ...budgetConfig, [configKey]: Number(e.target.value) })}
                        style={{ width: 110, textAlign: "right", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, padding: "4px 8px", fontSize: 13, color: "#2980B9", fontWeight: 600, background: "rgba(41,128,185,0.05)", outline: "none" }}
                      />
                    ) : (
                      fmt(pVal)
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#C9A84C", fontWeight: 700 }}>{fmt(aVal)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: diff >= 0 ? "#27AE60" : "#E74C3C", fontWeight: 600 }}>{fmt(diff)}</td>
                </tr>
              );
            })}
            <tr style={{ background: "rgba(27,42,74,0.03)", borderTop: "2px solid rgba(27,42,74,0.1)" }}>
              <td style={{ padding: "12px 16px", color: "#1B2A4A", fontWeight: 800 }}>TOTAL CHARGES</td>
              <td style={{ padding: "12px 16px", textAlign: "right", color: "#2980B9", fontWeight: 800 }}>{fmt(plan.totalCharges)}</td>
              <td style={{ padding: "12px 16px", textAlign: "right", color: "#C9A84C", fontWeight: 800 }}>{fmt(actual.totalCharges)}</td>
              <td style={{ padding: "12px 16px", textAlign: "right", color: plan.totalCharges - actual.totalCharges >= 0 ? "#27AE60" : "#E74C3C", fontWeight: 800 }}>{fmt(plan.totalCharges - actual.totalCharges)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ padding: "16px 24px", background: "rgba(39, 174, 96, 0.05)", borderRadius: 12, border: "1px solid rgba(39, 174, 96, 0.2)", marginBottom: 32 }}>
        <div style={{ color: "#27AE60", fontSize: 14, fontWeight: 800, marginBottom: 12, letterSpacing: 1 }}>RÉSUMÉ DE RENTABILITÉ</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16 }}>
          <div style={{ color: "#1B2A4A", fontSize: 18, fontWeight: 800 }}>BÉNÉFICE NET FINAL (TTC)</div>
          <div style={{ color: "#2980B9", fontSize: 18, fontWeight: 800, textAlign: "right" }}>{fmt(plan.net)}</div>
          <div style={{ color: "#C9A84C", fontSize: 18, fontWeight: 800, textAlign: "right" }}>{fmt(actual.net)} F</div>
          <div style={{ color: actual.net - plan.net >= 0 ? "#27AE60" : "#E74C3C", fontSize: 18, fontWeight: 800, textAlign: "right" }}>{fmt(actual.net - plan.net)}</div>
        </div>
      </div>

      <ExpenseManager expenses={expenses} seminars={seminars} refreshExpenses={refreshExpenses} budgetConfig={budgetConfig} setBudgetConfig={setBudgetConfig} />
    </div>
  );
}
