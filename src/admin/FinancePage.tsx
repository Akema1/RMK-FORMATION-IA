import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { fmt } from '../data/seminars';
import { DEFAULT_BUDGET_CONFIG, card, inputS, selectS, btnPrimary, btnSecondary, label, ORANGE, EXPENSE_CATEGORIES } from './config';
import type { Seminar, Participant, Expense, BudgetConfig, Prices, Charges, FinancialResult, SeminarBudgetConfigs } from './types';
import { aggregatePlanGlobally } from './finance/aggregatePlanGlobally';

// ─── Constants ───
const NAVY = '#1B2A4A';
const GOLD = '#C9A84C';
const GREEN = '#27AE60';
const RED = '#E74C3C';
const BLUE = '#2980B9';

// ─── Props ───
interface FinancePageProps {
  participants: Participant[];
  seminars: Seminar[];
  prices: Prices;
  expenses: Expense[];
  refreshExpenses: () => Promise<void>;
  seminarBudgets: SeminarBudgetConfigs;
  setSeminarBudgets: (budgets: SeminarBudgetConfigs) => void;
}

interface ExpenseManagerProps {
  expenses: Expense[];
  seminars: Seminar[];
  refreshExpenses: () => Promise<void>;
  currentSeminarId: string;
  seminarBudgets: SeminarBudgetConfigs;
  setSeminarBudgets: (budgets: SeminarBudgetConfigs) => void;
}

// ─── KPI Card ───
function KpiCard({ title, value, subtitle, color, bgTint }: {
  title: string;
  value: string;
  subtitle?: string;
  color: string;
  bgTint: string;
}) {
  return (
    <div style={{
      ...card,
      flex: 1,
      minWidth: 160,
      background: bgTint,
      borderColor: `${color}33`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `${color}0A`,
      }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: `${color}BB`, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: `${color}99`, marginTop: 6, fontWeight: 600 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ─── Scenario Projection Card ───
function ScenarioCard({ title, participants: pax, revenue, charges, net, roi, tint, borderColor }: {
  title: string;
  participants: number;
  revenue: number;
  charges: number;
  net: number;
  roi: number;
  tint: string;
  borderColor: string;
}) {
  return (
    <div style={{
      ...card,
      flex: 1,
      background: tint,
      border: `2px solid ${borderColor}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 4, background: borderColor,
      }} />
      <div style={{ fontSize: 13, fontWeight: 800, color: borderColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>Participants / sem.</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: borderColor }}>{pax}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>Revenus totaux</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{fmt(revenue)} F</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>Charges totales</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: RED }}>{fmt(charges)} F</span>
        </div>
        <div style={{ height: 1, background: `${borderColor}33`, margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: NAVY, fontWeight: 800 }}>Benefice net</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: net >= 0 ? GREEN : RED }}>{fmt(net)} F</span>
        </div>
        <div style={{
          display: 'inline-flex', alignSelf: 'flex-end',
          padding: '4px 12px', borderRadius: 100,
          background: roi >= 0 ? `${GREEN}18` : `${RED}18`,
          color: roi >= 0 ? GREEN : RED,
          fontSize: 13, fontWeight: 800,
        }}>
          ROI {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

// ─── Custom Pie Label ───
function renderPieLabel(props: PieLabelRenderProps): React.ReactElement | null {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
  const name = String(props.name ?? '');
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill={NAVY} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 11, fontWeight: 600 }}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// ─── ExpenseManager (preserved from original) ───
function ExpenseManager({ expenses, seminars, refreshExpenses, currentSeminarId, seminarBudgets, setSeminarBudgets }: ExpenseManagerProps) {
  const [form, setForm] = useState({ label: "", amount: 0, category: "consultance_pres", seminar: "all", paid: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", amount: 0, category: "", seminar: "", paid: false });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    await supabase.from('expenses').delete().eq('id', id);
    setDeleteConfirm(null);
    refreshExpenses();
  };

  const isGlobal = currentSeminarId === "global";
  const activeBudget = isGlobal ? DEFAULT_BUDGET_CONFIG : (seminarBudgets[currentSeminarId] || DEFAULT_BUDGET_CONFIG);

  const [showBudgetConfig, setShowBudgetConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState<BudgetConfig>(activeBudget);

  const openBudgetConfig = () => {
    setTempConfig(isGlobal ? DEFAULT_BUDGET_CONFIG : (seminarBudgets[currentSeminarId] || DEFAULT_BUDGET_CONFIG));
    setShowBudgetConfig(true);
  };

  const saveBudgetConfig = async () => {
    if (isGlobal) {
      const updated: SeminarBudgetConfigs = {};
      for (const s of seminars) {
        updated[s.id] = { ...tempConfig };
      }
      setSeminarBudgets(updated);
      const { error } = await supabase.from('settings').upsert({ id: 'seminar_budgets', value: updated });
      if (error) { console.error('Budget save failed:', error.message); alert('Erreur: budget non enregistre. ' + error.message); }
    } else {
      const updated: SeminarBudgetConfigs = { ...seminarBudgets, [currentSeminarId]: tempConfig };
      setSeminarBudgets(updated);
      const { error } = await supabase.from('settings').upsert({ id: 'seminar_budgets', value: updated });
      if (error) { console.error('Budget save failed:', error.message); alert('Erreur: budget non enregistre. ' + error.message); }
    }
    setShowBudgetConfig(false);
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openBudgetConfig} style={{ background: "rgba(0,0,0,0.05)", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          {isGlobal ? "Appliquer un modele a tous les seminaires" : "Configuration du budget de ce seminaire"}
        </button>
      </div>

      {showBudgetConfig && (
        <div style={{ ...card, marginBottom: 24, background: "#fff", border: `2px solid rgba(201,168,76,0.5)` }}>
          <h4 style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            {isGlobal ? "Appliquer ce modele a tous les seminaires" : `Budget previsionnel : ${seminars.find(s => s.id === currentSeminarId)?.code || currentSeminarId}`}
          </h4>
          {isGlobal && (
            <p style={{ color: "#E67E22", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
              Attention : cela remplacera les budgets individuels de tous les seminaires.
            </p>
          )}
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
            <button onClick={saveBudgetConfig} style={btnPrimary}>{isGlobal ? "Appliquer a tous" : "Enregistrer les parametres"}</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color: NAVY, fontSize: 20, fontWeight: 800, margin: 0 }}>Gestion des Depenses</h3>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ background: `${GREEN}1A`, color: GREEN, padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            Paye : {fmt(totalPaid)} F
          </div>
          <div style={{ background: "rgba(243, 156, 18, 0.1)", color: "#E67E22", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            A Payer : {fmt(totalPending)} F
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
          <div><label style={label}>Nouvelle Depense *</label><input style={inputS} value={form.label} onChange={upd("label")} placeholder="Ex: Achat fournitures..." /></div>
          <div><label style={label}>Montant (FCFA) *</label><input type="number" style={inputS} value={form.amount} onChange={upd("amount")} /></div>
          <div><label style={label}>Categorie Exacte</label>
            <select style={selectS} value={form.category} onChange={upd("category")}>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div><label style={label}>Affectation</label>
            <select style={selectS} value={form.seminar} onChange={upd("seminar")}>
              <option value="all">Tous (Frais Generaux)</option>
              {seminars.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: NAVY, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              <input type="checkbox" checked={form.paid} onChange={upd("paid")} /> Paye
            </label>
          </div>
          <button onClick={saveExpense} style={{ ...btnPrimary, height: 42 }}>+ Ajouter</button>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr", padding: "12px 16px", background: NAVY, color: "#fff", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
          <div>Libelle</div><div>Montant</div><div>Categorie</div><div>Affectation</div><div style={{ textAlign: "right" }}>Actions</div>
        </div>
        {expenses.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Aucune depense enregistree.</div>
        ) : expenses.map(e => (
          editingId === e.id ? (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center", gap: 12, background: `${GOLD}0D` }}>
              <input style={{ ...inputS, padding: "8px 12px" }} value={editForm.label} onChange={updEdit("label")} />
              <input type="number" style={{ ...inputS, padding: "8px 12px" }} value={editForm.amount} onChange={updEdit("amount")} />
              <select style={{ ...selectS, padding: "8px 12px" }} value={editForm.category} onChange={updEdit("category")}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select style={{ ...selectS, padding: "8px 12px" }} value={editForm.seminar} onChange={updEdit("seminar")}>
                <option value="all">Tous (General)</option>
                {seminars.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => saveEdit(e.id)} style={{ background: GREEN, border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>OK</button>
                <button onClick={cancelEdit} style={{ background: RED, border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>X</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center", transition: "background 0.2s" }} onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,0,0,0.02)"} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
              <div style={{ color: NAVY, fontSize: 13, fontWeight: 600 }}>{e.label}</div>
              <div style={{ color: RED, fontSize: 13, fontWeight: 700 }}>{fmt(e.amount)} F</div>
              <div style={{ color: NAVY, fontSize: 12, display: "flex", alignItems: "center" }}>
                <span style={{ padding: "4px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 4 }}>
                  {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                </span>
              </div>
              <div style={{ color: NAVY, fontSize: 12, fontWeight: 500 }}>{e.seminar === "all" ? "General" : seminars.find(s => s.id === e.seminar)?.code}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                <button onClick={() => togglePaidStatus(e)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }} title={e.paid ? "Marquer comme en attente" : "Marquer comme paye"}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: e.paid ? GREEN : "#E67E22", background: e.paid ? `${GREEN}26` : "rgba(243,156,18,0.15)", padding: "4px 8px", borderRadius: 100, border: `1px solid ${e.paid ? `${GREEN}4D` : "rgba(243,156,18,0.3)"}` }}>
                    {e.paid ? "Paye" : "En attente"}
                  </span>
                </button>
                <button onClick={() => startEdit(e)} style={{ background: "none", border: "none", color: "rgba(0,0,0,0.4)", cursor: "pointer", fontSize: 14 }} title="Modifier">Mod.</button>
                {deleteConfirm === e.id ? (
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => deleteExpense(e.id)} style={{ background: '#DC2626', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Oui</button>
                    <button onClick={() => setDeleteConfirm(null)} style={{ background: '#94A3B8', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Non</button>
                  </span>
                ) : (
                  <button onClick={() => setDeleteConfirm(e.id)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 14, fontWeight: 700 }} title="Supprimer">Suppr.</button>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ─── FinancePage ───
export function FinancePage({ participants, seminars, prices, expenses, refreshExpenses, seminarBudgets, setSeminarBudgets }: FinancePageProps) {
  const [view, setView] = useState("global");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const confirmed = participants.filter(p => p.status === "confirmed");

  const getBudgetForSeminar = (seminarId: string): BudgetConfig => {
    return seminarBudgets[seminarId] || DEFAULT_BUDGET_CONFIG;
  };

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
      const bc = getBudgetForSeminar(seminarId);
      charges = {
        consultance_pres: bc.consultance_pres,
        consultance_ligne: bc.consultance_ligne,
        billet_avion: bc.billet_avion,
        sejour: bc.sejour,
        salle: bc.salle,
        pauses_cafe: bc.pauses_cafe,
        dejeuner: bc.dejeuner,
        supports: bc.supports,
        equipements: bc.equipements,
        divers: bc.divers,
        transport: bc.transport,
        commercialisation: totalRevenus * bc.commercialisation_pct,
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
    // Sum every field symmetrically across seminars. Upstream had billet_avion
    // and transport special-cased to semPlans[0]?.charges.X, which broke the
    // breakdown-sum-equals-totalCharges invariant when per-seminar budgets
    // diverge. Centralized in aggregatePlanGlobally() + covered by
    // api/finance-aggregate.test.ts so re-ports cannot silently regress.
    plan = aggregatePlanGlobally(seminars.map(s => calculateFinancials(s.id, true)));
  }

  // ─── Derived data for charts ───
  const seminarCount = view === "global" ? seminars.length : 1;
  const margeBrute = plan.totalRevenus - plan.totalCharges;
  const margePct = plan.totalRevenus > 0 ? (margeBrute / plan.totalRevenus) * 100 : 0;
  const chargesPctOfRevenue = plan.totalRevenus > 0 ? (plan.totalCharges / plan.totalRevenus) * 100 : 0;

  // Break-even: find minimum participants to cover charges for one seminar
  const avgRevenuePerPax = prices.standard * 0.67 + prices.earlyBird * 0.33;
  const singleSemCharges = plan.totalCharges / Math.max(seminarCount, 1);
  const breakEvenPax = avgRevenuePerPax > 0 ? Math.ceil(singleSemCharges / avgRevenuePerPax) : 0;

  const roiPlan = plan.totalCharges > 0 ? ((plan.net / plan.totalCharges) * 100) : 0;

  // Revenue breakdown data (plan)
  const coachingRevenue = plan.totalPax * prices.coaching;
  const revenueBreakdown = [
    { name: 'Tarif Standard', value: plan.revStandard, color: NAVY },
    { name: 'Early Bird', value: plan.revEarlyBird, color: GOLD },
    { name: 'Coaching', value: coachingRevenue, color: GREEN },
  ].filter(d => d.value > 0);

  // Expense breakdown data (plan, sorted desc)
  const expenseBreakdown = [
    { name: 'Consultance (Pres.)', value: plan.charges.consultance_pres },
    { name: 'Consultance (Ligne)', value: plan.charges.consultance_ligne },
    { name: 'Billet avion', value: plan.charges.billet_avion },
    { name: 'Hebergement', value: plan.charges.sejour },
    { name: 'Salle', value: plan.charges.salle },
    { name: 'Pauses cafe', value: plan.charges.pauses_cafe },
    { name: 'Dejeuners', value: plan.charges.dejeuner },
    { name: 'Supports', value: plan.charges.supports },
    { name: 'Equipements', value: plan.charges.equipements },
    { name: 'Communication', value: plan.charges.commercialisation },
    { name: 'Transport', value: plan.charges.transport },
    { name: 'Divers', value: plan.charges.divers },
  ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  // Plan vs Real comparison data
  const comparisonData = [
    { name: 'Revenus Std', Plan: plan.revStandard, Reel: actual.revStandard },
    { name: 'Revenus EB', Plan: plan.revEarlyBird, Reel: actual.revEarlyBird },
    { name: 'Charges', Plan: plan.totalCharges, Reel: actual.totalCharges },
    { name: 'Benefice', Plan: plan.net, Reel: actual.net },
  ];

  // Monthly cash flow projection
  const registrationRates = [0.30, 0.50, 0.80, 1.0];
  const monthLabels = ['M-4', 'M-3', 'M-2', 'M-1 (Seminaire)'];
  const monthlyCashFlow = registrationRates.map((rate, i) => {
    const cumulativeRevenue = plan.totalRevenus * rate;
    const cumulativeExpenses = plan.totalCharges * (0.4 + (i * 0.2));
    return {
      month: monthLabels[i],
      Revenus: Math.round(cumulativeRevenue),
      Charges: Math.round(cumulativeExpenses),
      Solde: Math.round(cumulativeRevenue - cumulativeExpenses),
    };
  });

  // Scenario projections
  const buildScenario = (paxPerSeminar: number) => {
    const stdPax = Math.round(paxPerSeminar * 0.67);
    const ebPax = paxPerSeminar - stdPax;
    const totalRev = (stdPax * prices.standard + ebPax * prices.earlyBird) * seminarCount;
    const totalCh = plan.totalCharges;
    const provisionnel = totalRev - totalCh;
    const imp = provisionnel > 0 ? provisionnel * 0.1 : 0;
    const brut = provisionnel - imp;
    const tvaSc = brut > 0 ? brut * 0.18 : 0;
    const netSc = brut - tvaSc;
    const roiSc = totalCh > 0 ? (netSc / totalCh) * 100 : 0;
    return { pax: paxPerSeminar, revenue: totalRev, charges: totalCh, net: netSc, roi: roiSc };
  };

  const pessimiste = buildScenario(8);
  const realiste = buildScenario(12);
  const optimiste = buildScenario(18);

  // ─── Charge rows for breakdown table ───
  const chargeRows = [
    { label: "Consultance (Presentiel)", key: "consultance_pres" },
    { label: "Consultance (Ligne)", key: "consultance_ligne" },
    { label: "Billet d'avion", key: "billet_avion" },
    { label: "Hebergement / Sejour", key: "sejour" },
    { label: "Location Salle", key: "salle" },
    { label: "Pauses Cafe", key: "pauses_cafe" },
    { label: "Dejeuners", key: "dejeuner" },
    { label: "Supports Pedagogiques", key: "supports" },
    { label: "Equipements", key: "equipements" },
    { label: "Communication / Mkt", key: "commercialisation" },
    { label: "Transport local", key: "transport" },
    { label: "Divers & Imprevus", key: "divers" },
  ];

  // ─── PDF export (updated with projections) ───
  const exportPDF = () => {
    const doc = new jsPDF();
    const title = view === "global" ? "Tous les seminaires" : seminars.find(s => s.id === view)?.title || "Seminaire";
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
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 155, 22);
    doc.text("RMK CONSEILS", 155, 32);

    doc.setTextColor(...brandNavy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("1. Synthese Globale", 14, 60);

    autoTable(doc, {
      startY: 65,
      head: [['Indicateur', 'Plan (Budget)', 'Reel (Actuel)', 'Ecart']],
      body: [
        ['Revenus (Standard)', fmt(plan.revStandard), fmt(actual.revStandard), fmt(actual.revStandard - plan.revStandard)],
        ['Revenus (Early Bird)', fmt(plan.revEarlyBird), fmt(actual.revEarlyBird), fmt(actual.revEarlyBird - plan.revEarlyBird)],
        ['TOTAL REVENUS', fmt(plan.totalRevenus), fmt(actual.totalRevenus), fmt(actual.totalRevenus - plan.totalRevenus)],
        ['TOTAL CHARGES', fmt(plan.totalCharges), fmt(actual.totalCharges), fmt(plan.totalCharges - actual.totalCharges)],
        ['BENEFICE NET', fmt(plan.net), fmt(actual.net), fmt(actual.net - plan.net)],
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
    doc.text("2. Details des Depenses", 14, finalY);

    const chargesDiff = (p: number, a: number) => fmt(p - a);
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Categorie de Depense', 'Budget (Plan)', 'Reel (Depenses)', 'Ecart']],
      body: [
        ['Consultance (Presentiel)', fmt(plan.charges.consultance_pres || 0), fmt(actual.charges.consultance_pres || 0), chargesDiff(plan.charges.consultance_pres || 0, actual.charges.consultance_pres || 0)],
        ['Consultance (Ligne)', fmt(plan.charges.consultance_ligne || 0), fmt(actual.charges.consultance_ligne || 0), chargesDiff(plan.charges.consultance_ligne || 0, actual.charges.consultance_ligne || 0)],
        ["Billet d'avion", fmt(plan.charges.billet_avion || 0), fmt(actual.charges.billet_avion || 0), chargesDiff(plan.charges.billet_avion || 0, actual.charges.billet_avion || 0)],
        ['Hebergement / Sejour', fmt(plan.charges.sejour || 0), fmt(actual.charges.sejour || 0), chargesDiff(plan.charges.sejour || 0, actual.charges.sejour || 0)],
        ['Location Salle', fmt(plan.charges.salle || 0), fmt(actual.charges.salle || 0), chargesDiff(plan.charges.salle || 0, actual.charges.salle || 0)],
        ['Pauses Cafe', fmt(plan.charges.pauses_cafe || 0), fmt(actual.charges.pauses_cafe || 0), chargesDiff(plan.charges.pauses_cafe || 0, actual.charges.pauses_cafe || 0)],
        ['Dejeuners', fmt(plan.charges.dejeuner || 0), fmt(actual.charges.dejeuner || 0), chargesDiff(plan.charges.dejeuner || 0, actual.charges.dejeuner || 0)],
        ['Supports Pedagogiques', fmt(plan.charges.supports || 0), fmt(actual.charges.supports || 0), chargesDiff(plan.charges.supports || 0, actual.charges.supports || 0)],
        ['Equipements', fmt(plan.charges.equipements || 0), fmt(actual.charges.equipements || 0), chargesDiff(plan.charges.equipements || 0, actual.charges.equipements || 0)],
        ['Communication / Mkt', fmt(plan.charges.commercialisation || 0), fmt(actual.charges.commercialisation || 0), chargesDiff(plan.charges.commercialisation || 0, actual.charges.commercialisation || 0)],
        ['Transport local', fmt(plan.charges.transport || 0), fmt(actual.charges.transport || 0), chargesDiff(plan.charges.transport || 0, actual.charges.transport || 0)],
        ['Divers & Imprevus', fmt(plan.charges.divers || 0), fmt(actual.charges.divers || 0), chargesDiff(plan.charges.divers || 0, actual.charges.divers || 0)],
      ],
      headStyles: { fillColor: brandNavy, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: brandNavy, fontSize: 10 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' } },
      alternateRowStyles: { fillColor: brandLight },
      theme: 'grid',
    });

    // Projections page
    doc.addPage();
    doc.setFillColor(...brandNavy);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("3. Projections Financieres", 14, 20);

    autoTable(doc, {
      startY: 40,
      head: [['Scenario', 'Participants/Sem.', 'Revenus', 'Charges', 'Benefice Net', 'ROI']],
      body: [
        ['Pessimiste', String(pessimiste.pax), fmt(pessimiste.revenue), fmt(pessimiste.charges), fmt(pessimiste.net), `${pessimiste.roi.toFixed(1)}%`],
        ['Realiste', String(realiste.pax), fmt(realiste.revenue), fmt(realiste.charges), fmt(realiste.net), `${realiste.roi.toFixed(1)}%`],
        ['Optimiste', String(optimiste.pax), fmt(optimiste.revenue), fmt(optimiste.charges), fmt(optimiste.net), `${optimiste.roi.toFixed(1)}%`],
      ],
      headStyles: { fillColor: brandNavy, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      bodyStyles: { textColor: brandNavy, fontSize: 11 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'center', fontStyle: 'bold' } },
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

  return (
    <div>
      {/* Header + Seminar Filters */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: NAVY, fontSize: 24, fontWeight: 800, margin: 0 }}>Gestion Financiere</h2>
          {saveStatus === 'saving' && <span style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Enregistrement...</span>}
          {saveStatus === 'saved' && <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>✓ Enregistre</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>✗ Erreur d'enregistrement</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportPDF} style={{ ...btnPrimary, background: GREEN, marginRight: 16 }}>Exporter PDF</button>
          <button onClick={() => setView("global")} style={{ ...btnSecondary, background: view === "global" ? `${ORANGE}22` : undefined, color: view === "global" ? ORANGE : "rgba(0,0,0,0.5)" }}>Vue Globale</button>
          {seminars.map(s => (
            <button key={s.id} onClick={() => setView(s.id)} style={{ ...btnSecondary, background: view === s.id ? `${s.color}22` : undefined, color: view === s.id ? s.color : "rgba(0,0,0,0.5)" }}>{s.code}</button>
          ))}
        </div>
      </div>

      {/* ── Section 1: KPI Cards ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <KpiCard
          title="Revenus Totaux (Plan)"
          value={`${fmt(plan.totalRevenus)} F`}
          subtitle={`${plan.totalPax} participants prevus`}
          color={BLUE}
          bgTint={`${BLUE}08`}
        />
        <KpiCard
          title="Charges Totales"
          value={`${fmt(plan.totalCharges)} F`}
          subtitle={`${chargesPctOfRevenue.toFixed(0)}% du revenu`}
          color={RED}
          bgTint={`${RED}08`}
        />
        <KpiCard
          title="Marge Brute"
          value={`${fmt(margeBrute)} F`}
          subtitle={`${margePct >= 0 ? '+' : ''}${margePct.toFixed(1)}% de marge`}
          color={margeBrute >= 0 ? GREEN : RED}
          bgTint={margeBrute >= 0 ? `${GREEN}08` : `${RED}08`}
        />
        <KpiCard
          title="Seuil de Rentabilite"
          value={`${breakEvenPax} pax / sem.`}
          subtitle="Minimum pour couvrir les charges"
          color={GOLD}
          bgTint={`${GOLD}08`}
        />
        <KpiCard
          title="ROI Projete"
          value={`${roiPlan >= 0 ? '+' : ''}${roiPlan.toFixed(1)}%`}
          subtitle="Retour sur investissement"
          color={roiPlan >= 0 ? GREEN : RED}
          bgTint={roiPlan >= 0 ? `${GREEN}08` : `${RED}08`}
        />
      </div>

      {/* ── Section 2: Multi-Chart Dashboard ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* A. Revenue Breakdown Donut */}
        <div style={{ ...card, minHeight: 320 }}>
          <h3 style={{ color: NAVY, fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: 0 }}>
            Repartition des Revenus (Plan)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={revenueBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={renderPieLabel}
              >
                {revenueBreakdown.map((entry, idx) => (
                  <Cell key={`rev-${idx}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${fmt(Number(value))} FCFA`} contentStyle={{ background: NAVY, border: 'none', color: '#fff', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* B. Expense Breakdown Horizontal Bar */}
        <div style={{ ...card, minHeight: 320 }}>
          <h3 style={{ color: NAVY, fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: 0 }}>
            Ventilation des Charges (Plan)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={expenseBreakdown} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} stroke="rgba(0,0,0,0.3)" fontSize={10} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: NAVY }} />
              <Tooltip formatter={(value) => `${fmt(Number(value))} FCFA`} contentStyle={{ background: NAVY, border: 'none', color: '#fff', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={GOLD}>
                {expenseBreakdown.map((_, idx) => (
                  <Cell key={`exp-${idx}`} fill={idx % 2 === 0 ? NAVY : GOLD} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* C. Plan vs Real Comparison */}
        <div style={{ ...card, minHeight: 320 }}>
          <h3 style={{ color: NAVY, fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: 0 }}>
            Comparatif Plan vs Reel
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={comparisonData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <YAxis stroke="rgba(0,0,0,0.4)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} fontSize={10} />
              <Tooltip formatter={(value) => `${fmt(Number(value))} FCFA`} contentStyle={{ background: NAVY, border: 'none', color: '#fff', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Plan" fill={BLUE} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Reel" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* D. Monthly Cash Flow Projection */}
        <div style={{ ...card, minHeight: 320 }}>
          <h3 style={{ color: NAVY, fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: 0 }}>
            Projection Cash Flow Mensuel
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyCashFlow} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="gradRevenu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradCharges" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={RED} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="month" stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} stroke="rgba(0,0,0,0.4)" fontSize={10} />
              <Tooltip formatter={(value) => `${fmt(Number(value))} FCFA`} contentStyle={{ background: NAVY, border: 'none', color: '#fff', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Revenus" stroke={GREEN} fill="url(#gradRevenu)" strokeWidth={2} />
              <Area type="monotone" dataKey="Charges" stroke={RED} fill="url(#gradCharges)" strokeWidth={2} />
              <Area type="monotone" dataKey="Solde" stroke={BLUE} fill="none" strokeWidth={2} strokeDasharray="6 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Section 3: Financial Projections ── */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ color: NAVY, fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Projections Financieres</h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <ScenarioCard
            title="Pessimiste"
            participants={pessimiste.pax}
            revenue={pessimiste.revenue}
            charges={pessimiste.charges}
            net={pessimiste.net}
            roi={pessimiste.roi}
            tint={`${RED}08`}
            borderColor={RED}
          />
          <ScenarioCard
            title="Realiste"
            participants={realiste.pax}
            revenue={realiste.revenue}
            charges={realiste.charges}
            net={realiste.net}
            roi={realiste.roi}
            tint={`${GOLD}08`}
            borderColor={GOLD}
          />
          <ScenarioCard
            title="Optimiste"
            participants={optimiste.pax}
            revenue={optimiste.revenue}
            charges={optimiste.charges}
            net={optimiste.net}
            roi={optimiste.roi}
            tint={`${GREEN}08`}
            borderColor={GREEN}
          />
        </div>
      </div>

      {/* ── Section 4: Charges Breakdown Table (existing, preserved) ── */}
      <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 32 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: NAVY }}>Categorie de Depense</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: BLUE }}>Budget (Plan)</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: GOLD }}>Reel (Depenses)</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: NAVY }}>Ecart</th>
            </tr>
          </thead>
          <tbody>
            {chargeRows.map((row, i) => {
              const pVal = plan.charges[row.key] || 0;
              const aVal = actual.charges[row.key] || 0;
              const diff = pVal - aVal;
              const isGlobal = view === "global";
              const currentBudget = isGlobal ? DEFAULT_BUDGET_CONFIG : getBudgetForSeminar(view);
              const configKey = row.key as keyof BudgetConfig;
              const isEditable = !isGlobal && configKey in currentBudget && configKey !== "commercialisation_pct";

              const handleInlineEdit = (newValue: number) => {
                const updatedBudget: BudgetConfig = { ...currentBudget, [configKey]: newValue };
                const updatedBudgets: SeminarBudgetConfigs = { ...seminarBudgets, [view]: updatedBudget };
                setSeminarBudgets(updatedBudgets);
                setSaveStatus('saving');
                supabase.from('settings').upsert({ id: 'seminar_budgets', value: updatedBudgets })
                  .then(({ error }) => {
                    if (error) { setSaveStatus('error'); console.error('Budget save failed:', error.message); }
                    else { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }
                  });
              };

              return (
                <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <td style={{ padding: "10px 16px", color: NAVY, fontWeight: 500 }}>{row.label}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: BLUE }}>
                    {isEditable ? (
                      <input
                        type="number"
                        value={currentBudget[configKey] || 0}
                        onChange={(e) => handleInlineEdit(Number(e.target.value))}
                        style={{ width: 110, textAlign: "right", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, padding: "4px 8px", fontSize: 13, color: BLUE, fontWeight: 600, background: `${BLUE}0D`, outline: "none" }}
                      />
                    ) : (
                      fmt(pVal)
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: GOLD, fontWeight: 700 }}>{fmt(aVal)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: diff >= 0 ? GREEN : RED, fontWeight: 600 }}>{fmt(diff)}</td>
                </tr>
              );
            })}
            <tr style={{ background: `${NAVY}08`, borderTop: `2px solid ${NAVY}1A` }}>
              <td style={{ padding: "12px 16px", color: NAVY, fontWeight: 800 }}>TOTAL CHARGES</td>
              <td style={{ padding: "12px 16px", textAlign: "right", color: BLUE, fontWeight: 800 }}>{fmt(plan.totalCharges)}</td>
              <td style={{ padding: "12px 16px", textAlign: "right", color: GOLD, fontWeight: 800 }}>{fmt(actual.totalCharges)}</td>
              <td style={{ padding: "12px 16px", textAlign: "right", color: plan.totalCharges - actual.totalCharges >= 0 ? GREEN : RED, fontWeight: 800 }}>{fmt(plan.totalCharges - actual.totalCharges)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Section 5: Profitability Summary (existing, preserved) ── */}
      <div style={{ padding: "16px 24px", background: `${GREEN}0D`, borderRadius: 12, border: `1px solid ${GREEN}33`, marginBottom: 32 }}>
        <div style={{ color: GREEN, fontSize: 14, fontWeight: 800, marginBottom: 12, letterSpacing: 1 }}>RESUME DE RENTABILITE</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16 }}>
          <div style={{ color: NAVY, fontSize: 18, fontWeight: 800 }}>BENEFICE NET FINAL (TTC)</div>
          <div style={{ color: BLUE, fontSize: 18, fontWeight: 800, textAlign: "right" }}>{fmt(plan.net)}</div>
          <div style={{ color: GOLD, fontSize: 18, fontWeight: 800, textAlign: "right" }}>{fmt(actual.net)} F</div>
          <div style={{ color: actual.net - plan.net >= 0 ? GREEN : RED, fontSize: 18, fontWeight: 800, textAlign: "right" }}>{fmt(actual.net - plan.net)}</div>
        </div>
      </div>

      {/* ── Section 6: Expense Manager (existing, preserved) ── */}
      <ExpenseManager expenses={expenses} seminars={seminars} refreshExpenses={refreshExpenses} currentSeminarId={view} seminarBudgets={seminarBudgets} setSeminarBudgets={setSeminarBudgets} />
    </div>
  );
}
