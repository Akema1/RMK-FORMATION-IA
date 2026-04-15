import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { LogoRMK } from "../components/LogoRMK";

// Admin modules
import { DEFAULT_SEMINARS, DEFAULT_PRICES, SURFACE_BG, ORANGE, card, btnPrimary } from "../admin/config";
import type { Seminar, Participant, Expense, Task, Lead, Prices, SeminarBudgetConfigs, SeminarPricingConfigs } from "../admin/types";
import { Nav } from "../admin/Nav";
import { DashboardPage } from "../admin/DashboardPage";
import { SeminarsManagement } from "../admin/SeminarsManagement";
import { InscriptionsPage } from "../admin/InscriptionsPage";
import { FinancePage } from "../admin/FinancePage";
import { TasksPage } from "../admin/TasksPage";
import { FormationTrackingPage } from "../admin/FormationTrackingPage";
import { ContentStudio } from "../admin/ContentStudio";
import { AgentHub } from "../admin/AgentHub";

// ─── Supabase User type ───
interface SupabaseUser {
  email?: string;
  user_metadata?: { name?: string };
}

// Blocker #3: bound every admin fetcher so a single page load can't pull an
// unbounded table into memory. 500 rows is way above the expected dataset
// for this seminar program and keeps the dashboard payload under control.
const ADMIN_FETCH_LIMIT = 500;

export default function AdminDashboard() {
  const [page, setPage] = useState("dashboard");
  const [user, setUser] = useState<SupabaseUser | null>(null);

  const [prices, setPrices] = useState<Prices>(DEFAULT_PRICES);
  const [seminarBudgets, setSeminarBudgets] = useState<SeminarBudgetConfigs>({});
  const [seminarPricing, setSeminarPricing] = useState<SeminarPricingConfigs>({});
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Data Fetchers ───
  const fetchSeminars = async () => {
    const { data } = await supabase.from('seminars').select('*').order('code', { ascending: true }).limit(ADMIN_FETCH_LIMIT);
    if (data && data.length > 0) {
      setSeminars(data as Seminar[]);
    } else {
      setSeminars(DEFAULT_SEMINARS);
    }
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from('participants').select('*').order('created_at', { ascending: false }).limit(ADMIN_FETCH_LIMIT);
    if (data) setParticipants(data as Participant[]);
  };

  const fetchExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(ADMIN_FETCH_LIMIT);
    if (data) setExpenses(data as Expense[]);
  };

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(ADMIN_FETCH_LIMIT);
    if (data) setTasks(data as Task[]);
  };

  const fetchLeads = async () => {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(ADMIN_FETCH_LIMIT);
    if (data) setLeads(data as Lead[]);
  };

  // ─── Init Data ───
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchSeminars().catch(() => { /* seminar fetch failed silently */ }),
          fetchParticipants().catch(() => { /* participants fetch failed silently */ }),
          fetchExpenses().catch(() => { /* expenses fetch failed silently */ }),
          fetchTasks().catch(() => { /* tasks fetch failed silently */ }),
          fetchLeads().catch(() => { /* leads fetch failed silently */ }),
          // Use maybeSingle(): settings rows are optional — .single() returns 406
          // when the row doesn't exist (empty table on a fresh branch DB), which
          // spams the browser console even though .catch() swallows it. maybeSingle
          // returns { data: null } for zero rows without raising.
          Promise.resolve(supabase.from('settings').select('*').eq('id', 'seminar_budgets').maybeSingle()).then(({ data }) => {
            if (data && data.value) setSeminarBudgets(data.value as SeminarBudgetConfigs);
          }).catch(() => { /* seminar budgets fetch failed silently */ }),
          Promise.resolve(supabase.from('settings').select('*').eq('id', 'seminar_pricing').maybeSingle()).then(({ data }) => {
            if (data && data.value) setSeminarPricing(data.value as SeminarPricingConfigs);
          }).catch(() => { /* seminar pricing fetch failed silently */ })
        ]);
      } catch {
        // Critical initialization error handled silently
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  // ─── Auth ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');

    // NOTE: Upstream's "placeholder.supabase.co" dev-mode bypass was intentionally
    // removed during the security hardening pass on main. Do not reintroduce it —
    // it would grant free admin access if VITE_SUPABASE_URL were ever unset in prod.

    if (!email || !password) {
      setLoginError("Veuillez remplir tous les champs.");
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur d'authentification.";
      setLoginError(message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // ─── Login Screen ───
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: SURFACE_BG }}>
        <div style={{ ...card, textAlign: "center", maxWidth: 400, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ marginBottom: 24 }}>
            <LogoRMK scale={0.8} variant="light" />
          </div>
          <h1 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Espace Administrateur</h1>
          <p style={{ color: '#1B2A4A', fontSize: 14, marginBottom: 32 }}>Connectez-vous pour accéder au tableau de bord.</p>

          <form onSubmit={handleLogin} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.05)", color: "#1B2A4A", outline: "none" }}
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.05)", color: "#1B2A4A", outline: "none" }}
            />
            {loginError && <div style={{ color: "#E74C3C", fontSize: 13, marginTop: -8 }}>{loginError}</div>}

            <button type="submit" style={{ ...btnPrimary, width: "100%" }}>
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Main Admin Layout ───
  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: SURFACE_BG, minHeight: "100vh", color: "#1B2A4A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1); border-radius:3px; }
        input:focus, select:focus, textarea:focus { border-color:${ORANGE} !important; box-shadow:0 0 0 2px ${ORANGE}22; }
        details > summary { list-style:none; }
        details > summary::-webkit-details-marker { display:none; }
        button:hover { opacity:0.9; }
      `}</style>
      <Nav page={page} setPage={setPage} />
      <main style={{ marginLeft: 220, padding: "24px 32px", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.04)", padding: "8px 16px", borderRadius: 100 }}>
            <span style={{ fontSize: 13, color: '#1B2A4A' }}>{user.email}</span>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: ORANGE, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Déconnexion</button>
          </div>
        </div>
        {isLoading ? (
          <div>
            <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.04; } 50% { opacity: 0.08; } }`}</style>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ ...card, height: 100, background: "rgba(0,0,0,0.04)", animation: `skeleton-pulse 1.5s ease-in-out infinite ${i * 0.15}s` }} />
              ))}
            </div>
            <div style={{ ...card, height: 300, background: "rgba(0,0,0,0.04)", animation: "skeleton-pulse 1.5s ease-in-out infinite 0.6s", marginBottom: 24 }} />
          </div>
        ) : (
          <>
            {page === "dashboard" && <DashboardPage participants={participants} prices={prices} tasks={tasks} leads={leads} seminars={seminars} seminarBudgets={seminarBudgets} />}
            {page === "seminaires" && <SeminarsManagement seminars={seminars} refreshSeminars={fetchSeminars} prices={prices} setPrices={setPrices} seminarPricing={seminarPricing} setSeminarPricing={setSeminarPricing} />}
            {page === "inscriptions" && <InscriptionsPage participants={participants} seminars={seminars} refreshParticipants={fetchParticipants} />}
            {page === "finance" && <FinancePage participants={participants} seminars={seminars} prices={prices} expenses={expenses} refreshExpenses={fetchExpenses} seminarBudgets={seminarBudgets} setSeminarBudgets={setSeminarBudgets} />}
            {page === "tasks" && <TasksPage tasks={tasks} seminars={seminars} refreshTasks={fetchTasks} />}
            {page === "formation" && <FormationTrackingPage seminars={seminars} participants={participants} />}
            {page === "contenus" && <ContentStudio seminars={seminars} participants={participants} />}
            {page === "agents" && <AgentHub seminars={seminars} leads={leads} refreshLeads={fetchLeads} />}
          </>
        )}
      </main>
    </div>
  );
}
