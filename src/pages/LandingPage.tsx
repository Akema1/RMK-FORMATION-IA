import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "../lib/store";
import { supabase } from "../lib/supabaseClient";
import { LogoRMK } from "../components/LogoRMK";
import { SEMINARS, PRICE, EARLY_BIRD_PRICE, EARLY_BIRD_DEADLINE, fmt, type Seminar } from "../data/seminars";


function useCountdown(target: number) {
  const [diff, setDiff] = useState(target - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { days: d, hours: h, mins: m, secs: s, expired: false };
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}




// ─── COMPONENTS ───

function Nav({ page, setPage }: { page: string, setPage: (p: string) => void }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  const links = [
    { key: "home", label: "Accueil" },
    { key: "seminaires", label: "Séminaires" },
    { key: "tarifs", label: "Tarifs" },
    { key: "inscription", label: "Inscription" },
  ];
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? "rgba(27,42,74,0.97)" : "rgba(27,42,74,0.85)",
      backdropFilter: "blur(20px)", borderBottom: scrolled ? "1px solid rgba(201,168,76,0.3)" : "none",
      transition: "all 0.4s ease",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => { setPage("home"); window.scrollTo(0, 0); }}>
          <LogoRMK scale={0.5} variant="dark" />
          <div>
            <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15, letterSpacing: 0.5, lineHeight: 1.1 }}>RMK <span style={{ color: "#C9A84C" }}>×</span> CABEXIA</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>Formation IA · Abidjan</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }} className="nav-desktop">
          {links.map((l) => (
            <button key={l.key} onClick={() => { setPage(l.key); setMobileOpen(false); window.scrollTo(0, 0); }}
              style={{
                background: page === l.key ? "rgba(201,168,76,0.15)" : "transparent",
                border: "none", color: page === l.key ? "#C9A84C" : "#E2E8F0",
                padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                transition: "all 0.2s", letterSpacing: 0.3,
              }}>{l.label}</button>
          ))}
          <button onClick={() => navigate('/portal')}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)", color: "#E2E8F0",
                padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                transition: "all 0.2s", letterSpacing: 0.3, marginLeft: 8
              }}>Portail Client</button>
          <button onClick={() => navigate('/admin')}
              title="Administration"
              style={{
                background: "transparent",
                border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C",
                padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                transition: "all 0.2s", marginLeft: 4
              }}>⚙</button>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="nav-mobile-btn" style={{ display: "none", background: "none", border: "none", color: "#1B2A4A", fontSize: 24, cursor: "pointer" }}>
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>
      {mobileOpen && (
        <div style={{ background: "rgba(27,42,74,0.98)", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map((l) => (
            <button key={l.key} onClick={() => { setPage(l.key); setMobileOpen(false); window.scrollTo(0, 0); }}
              style={{ background: page === l.key ? "rgba(201,168,76,0.15)" : "transparent", border: "none", color: page === l.key ? "#C9A84C" : "#fff", padding: "12px 16px", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600, textAlign: "left" }}>
              {l.label}
            </button>
          ))}
          <button onClick={() => navigate('/portal')}
              style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.2)", color: "#fff", padding: "12px 16px", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600, textAlign: "left" }}>
              Portail Client
          </button>
          <button onClick={() => navigate('/admin')}
              style={{ background: "transparent", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", padding: "12px 16px", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600, textAlign: "left" }}>
              ⚙ Administration
          </button>
        </div>
      )}
    </nav>
  );
}

function CountdownBlock() {
  const cd = useCountdown(new Date("2026-05-05T08:30:00").getTime());
  const units = [
    { val: cd.days, label: "Jours" },
    { val: cd.hours, label: "Heures" },
    { val: cd.mins, label: "Minutes" },
    { val: cd.secs, label: "Secondes" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
      {units.map((u) => (
        <div key={u.label} style={{ background: "rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: "16px 20px", minWidth: 80, textAlign: "center", backdropFilter: "blur(10px)" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#C9A84C", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(u.val).padStart(2, "0")}</div>
          <div style={{ fontSize: 11, color: '#1B2A4A', textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>{u.label}</div>
        </div>
      ))}
    </div>
  );
}

function Hero({ setPage, seminars }: { setPage: (p: string) => void, seminars: Seminar[] }) {
  return (
    <section style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      background: "#FAF9F6",
      position: "relative", overflow: "hidden", padding: "120px 24px 60px",
    }}>
      <div style={{ position: "absolute", top: "10%", right: "5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "15%", left: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(27,42,74,0.1) 0%, transparent 70%)" }} />
      
      <div style={{ maxWidth: 800, textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 32, display: "flex", justifyContent: "center" }}><LogoRMK scale={1.8} variant="light" /></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 100, padding: "6px 20px", marginBottom: 32 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#27AE60", animation: "pulse 2s infinite" }} />
          <span style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>MAI 2026 · ABIDJAN · 4 SÉMINAIRES</span>
        </div>
        
        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, color: "#1B2A4A", lineHeight: 1.08, margin: "0 0 16px", letterSpacing: -1 }}>
          L'Intelligence Artificielle<br />
          <span style={{ background: "linear-gradient(90deg, #C9A84C, #D4B865)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            au Service de Votre Métier
          </span>
        </h1>
        
        <p style={{ fontSize: 18, color: '#1B2A4A', lineHeight: 1.7, margin: "0 0 12px", maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
          Formations exécutives en IA générative pour Managers, Dirigeants, Administrateurs, Consultants, Entrepreneurs, Cadres Supérieurs et Professionnels souhaitant accélérer leur transformation digitale et renforcer leurs décisions stratégiques.
        </p>
        <p style={{ fontSize: 14, color: '#1B2A4A', margin: "0 0 40px" }}>
          Organisé par <strong style={{ color: '#1B2A4A' }}>RMK Conseils</strong> · Formation délivrée par <strong style={{ color: "#C9A84C" }}>CABEXIA</strong>
        </p>
        
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
          <button onClick={() => { setPage("inscription"); window.scrollTo(0, 0); }} style={{
            background: "linear-gradient(135deg, #C9A84C, #A88A3D)", color: "#1B2A4A", border: "none",
            padding: "16px 36px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 24px rgba(201,168,76,0.4)", transition: "all 0.3s", letterSpacing: 0.5,
          }}>S'inscrire maintenant</button>
          <button onClick={() => { setPage("seminaires"); window.scrollTo(0, 0); }} style={{
            background: "rgba(0,0,0,0.06)", color: "#1B2A4A", border: "1px solid rgba(0,0,0,0.15)",
            padding: "16px 36px", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "all 0.3s",
          }}>Découvrir le programme →</button>
        </div>
        
        <CountdownBlock />
        <p style={{ color: '#1B2A4A', fontSize: 12, marginTop: 12, letterSpacing: 1 }}>AVANT LE PREMIER SÉMINAIRE</p>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 48, position: "relative", zIndex: 1 }}>
        {seminars.map((s: Seminar) => (
          <div key={s.id} style={{
            background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12,
            padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 200,
            borderLeft: `3px solid ${s.color}`,
          }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ color: "#1B2A4A", fontSize: 13, fontWeight: 700 }}>{s.code} · {s.title.split(" ").slice(-1)}</div>
              <div style={{ color: '#1B2A4A', fontSize: 11 }}>{s.week}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FormatSection() {
  const [ref, vis] = useInView();
  const steps = [
    { day: "Jour 1–3", mode: "Présentiel", icon: "🏢", desc: "Immersion complète en salle à Abidjan. Ateliers pratiques, démonstrations live, exercices sur vos propres documents." },
    { day: "Jour 4–5", mode: "En ligne", icon: "💻", desc: "Sessions Zoom de 4h (9h–13h). Approfondissement, retour d'expérience, feuille de route personnelle." },
  ];
  return (
    <section ref={ref} style={{ background: "#FAF9F6", padding: "80px 24px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(30px)", transition: "all 0.8s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ color: "#C9A84C", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Format Hybride</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1B2A4A", margin: 0 }}>5 jours qui transforment votre pratique</h2>
          <p style={{ color: '#1B2A4A', fontSize: 16, marginTop: 12 }}>Le meilleur du présentiel et du distanciel, combinés pour un impact maximal.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: "rgba(0,0,0,0.03)", borderRadius: 16, padding: 32, border: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>{s.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, color: "#1B2A4A", fontSize: 18 }}>{s.day}</div>
                  <div style={{ color: "#C9A84C", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{s.mode.toUpperCase()}</div>
                </div>
              </div>
              <p style={{ color: '#1B2A4A', lineHeight: 1.7, margin: 0, fontSize: 15 }}>{s.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 40, flexWrap: "wrap" }}>
          {[
            { n: "VIP", l: "Comité restreint" },
            { n: "100%", l: "Sur-mesure" },
            { n: "4", l: "Domaines métier" },
            { n: "80%", l: "Pratique" },
          ].map((k) => (
            <div key={k.l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#C9A84C" }}>{k.n}</div>
              <div style={{ fontSize: 12, color: "#64748B", letterSpacing: 1, textTransform: "uppercase" }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface SeminarCardProps {
  sem: Seminar;
  onSelect: (id: string) => void;
  delay?: number;
}

function SeminarCard({ sem, onSelect, delay = 0 }: SeminarCardProps) {
  const [ref, vis] = useInView();
  const [expanded, setExpanded] = useState(false);
  return (
    <div ref={ref} style={{
      background: "rgba(0,0,0,0.03)", borderRadius: 20, overflow: "hidden",
      border: "1px solid rgba(0,0,0,0.08)", opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(40px)",
      transition: `all 0.7s ease ${delay}ms`,
    }}>
      <div style={{ background: sem.gradient, padding: "28px 28px 20px", color: "#1B2A4A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, opacity: 0.8 }}>{sem.code} · {sem.week}</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 4px", lineHeight: 1.2 }}>{sem.title}</h3>
            <p style={{ fontSize: 14, opacity: 0.85, margin: 0 }}>{sem.subtitle}</p>
          </div>
          <span style={{ fontSize: 40 }}>{sem.icon}</span>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 12, opacity: 0.8 }}>
          <span>🏢 {sem.dates.presentiel}</span>
          <span>💻 {sem.dates.online}</span>
        </div>
      </div>
      <div style={{ padding: "24px 28px" }}>
        <div style={{ fontSize: 13, color: '#1B2A4A', marginBottom: 12 }}>
          <strong style={{ color: "#1B2A4A" }}>Public cible :</strong> {sem.target}
        </div>
        <div style={{ fontSize: 13, color: '#1B2A4A', marginBottom: 16 }}>
          <strong style={{ color: "#1B2A4A" }}>Accès :</strong> Sélection exclusive · Format intimiste
        </div>
        
        <button onClick={() => setExpanded(!expanded)} style={{
          background: "none", border: "none", color: sem.color, cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0, marginBottom: 12
        }}>{expanded ? "Masquer le programme ▲" : "Voir le programme détaillé ▼"}</button>
        
        {expanded && (
          <div style={{ marginBottom: 16, animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1B2A4A", marginBottom: 8 }}>Modules de formation :</div>
            {sem.modules.map((m: string, i: number) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <span style={{ color: sem.color, fontWeight: 800, fontSize: 12, minWidth: 24 }}>J{i + 1}</span>
                <span style={{ fontSize: 14, color: "#1B2A4A" }}>{m}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#1B2A4A" }}>Points clés :</div>
            {sem.highlights.map((h: string, i: number) => (
              <div key={i} style={{ fontSize: 13, color: '#1B2A4A', padding: "4px 0 4px 16px", position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: sem.color }}>›</span> {h}
              </div>
            ))}
          </div>
        )}
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#1B2A4A" }}>{fmt(PRICE)} <span style={{ fontSize: 13, fontWeight: 400, color: '#1B2A4A' }}>FCFA</span></div>
            <div style={{ fontSize: 12, color: "#27AE60", fontWeight: 600 }}>Early bird : {fmt(EARLY_BIRD_PRICE)} FCFA</div>
          </div>
          <button onClick={() => onSelect(sem.id)} style={{
            background: sem.gradient, color: "#1B2A4A", border: "none", padding: "12px 24px",
            borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
            boxShadow: `0 4px 16px ${sem.color}44`, transition: "all 0.3s",
          }}>S'inscrire →</button>
        </div>
      </div>
    </div>
  );
}

function SeminarsPage({ setPage, seminars, setSelectedSem }: { setPage: (p: string) => void; seminars: Seminar[]; setSelectedSem: (id: string) => void }) {
  return (
    <section style={{ background: "#FAF9F6", minHeight: "100vh", paddingTop: 100, paddingBottom: 80 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ color: "#C9A84C", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Programme Complet</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: "#1B2A4A", margin: "0 0 12px" }}>4 Séminaires, 4 Expertises</h2>
          <p style={{ color: '#1B2A4A', fontSize: 16 }}>Chaque séminaire : 3 jours présentiel à Abidjan + 2 sessions en ligne de 4h · Formation délivrée par CABEXIA</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: 24 }}>
          {seminars.map((s: Seminar, i: number) => (
            <SeminarCard key={s.id} sem={s} delay={i * 100} onSelect={(id: string) => { setSelectedSem(id); setPage("inscription"); window.scrollTo(0, 0); }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingPage({ setPage, seminars, setSelectedSem }: { setPage: (p: string) => void; seminars: Seminar[]; setSelectedSem: (id: string) => void }) {
  const [ref, vis] = useInView();
  const offers = [
    { name: "Standard", price: fmt(PRICE), unit: "FCFA / personne", features: ["5 jours de formation (3+2)", "Supports pédagogiques complets", "Restauration 3 jours présentiel", "Certificat de participation", "Accès aux replays en ligne"], cta: "S'inscrire", primary: false },
    { name: "Early Bird", price: fmt(EARLY_BIRD_PRICE), unit: "FCFA / personne", badge: "-10%", features: ["Tout le Standard inclus", "Réduction de 60 000 FCFA", "Inscription avant le 30 avril", "Places prioritaires", "Bonus : accès groupe WhatsApp VIP"], cta: "Profiter de l'offre", primary: true },
    { name: "Pack Entreprise", price: "Sur devis", unit: "dès 3 inscrits", features: ["-15% dès 3 inscrits même entreprise", "Pack 2 séminaires : -10%", "Pack 4 séminaires : -20%", "Facturation entreprise", "Coaching post-formation inclus"], cta: "Nous contacter", primary: false },
  ];
  return (
    <section style={{ background: "linear-gradient(170deg, #FAF9F6, #E0DCCD)", minHeight: "100vh", paddingTop: 100, paddingBottom: 80 }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(30px)", transition: "all 0.8s" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ color: "#C9A84C", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Tarifs</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: "#1B2A4A", margin: "0 0 12px" }}>Investissez dans votre avenir</h2>
          <p style={{ color: '#1B2A4A', fontSize: 16 }}>Tarif identique pour les 4 séminaires · Formation complète 5 jours hybride</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, alignItems: "start" }}>
          {offers.map((o, i) => (
            <div key={i} style={{
              background: o.primary ? "linear-gradient(170deg, #C9A84C, #A88A3D)" : "rgba(0,0,0,0.04)",
              border: o.primary ? "none" : "1px solid rgba(0,0,0,0.1)", borderRadius: 20, padding: 32,
              position: "relative", transform: o.primary ? "scale(1.03)" : "none",
            }}>
              {o.badge && <div style={{ position: "absolute", top: -12, right: 20, background: "#27AE60", color: "#1B2A4A", padding: "4px 14px", borderRadius: 100, fontSize: 13, fontWeight: 800 }}>{o.badge}</div>}
              <div style={{ fontSize: 14, fontWeight: 700, color: o.primary ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{o.name}</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#1B2A4A", marginBottom: 4 }}>{o.price}</div>
              <div style={{ fontSize: 13, color: o.primary ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)", marginBottom: 24 }}>{o.unit}</div>
              {o.features.map((f, j) => (
                <div key={j} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", color: o.primary ? "#fff" : "rgba(0,0,0,0.7)", fontSize: 14 }}>
                  <span style={{ color: o.primary ? "#fff" : "#27AE60" }}>✓</span> {f}
                </div>
              ))}
              <button onClick={() => { setPage("inscription"); window.scrollTo(0, 0); }} style={{
                width: "100%", marginTop: 24, padding: "14px 0", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer", transition: "all 0.3s",
                background: o.primary ? "#fff" : "rgba(201,168,76,0.2)", color: o.primary ? "#C9A84C" : "#C9A84C",
                border: o.primary ? "none" : "1px solid rgba(201,168,76,0.3)",
              }}>{o.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InscriptionPage({ selectedSem, seminars }: { selectedSem: string; seminars: Seminar[] }) {
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", tel: "", societe: "", fonction: "", seminaire: selectedSem || "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prices] = useLocalStorage("rmk_prices", { standard: 600000, earlyBird: 540000, discountPct: 10 });
  
  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: "" });
  };
  const inputStyle = { width: "100%", padding: "14px 16px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 15, fontFamily: "inherit", background: "#F8FAFC", outline: "none", boxSizing: "border-box", transition: "border 0.2s" } as React.CSSProperties;
  const errorStyle = { fontSize: 12, color: "#E74C3C", marginTop: 4, fontWeight: 600 } as React.CSSProperties;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs.nom = "Le nom est obligatoire";
    if (!form.prenom.trim()) errs.prenom = "Le prénom est obligatoire";
    if (!form.email.trim()) {
      errs.email = "L'email est obligatoire";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Format d'email invalide";
    }
    if (form.tel && !/^[+]?[\d\s()-]{8,20}$/.test(form.tel.trim())) {
      errs.tel = "Format de téléphone invalide (ex: +225 07 00 00 00 00)";
    }
    if (!form.societe.trim()) errs.societe = "La société est obligatoire";
    if (!form.fonction.trim()) errs.fonction = "La fonction est obligatoire";
    if (!form.seminaire) errs.seminaire = "Veuillez choisir un séminaire";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    setIsSubmitting(true);
    const isEarlyBird = new Date() <= EARLY_BIRD_DEADLINE;
    const amount = isEarlyBird ? prices.earlyBird : prices.standard;
    
    const newParticipant = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      email: form.email.trim().toLowerCase(),
      tel: form.tel.trim(),
      societe: form.societe.trim(),
      fonction: form.fonction.trim(),
      seminar: form.seminaire,
      amount: amount,
      status: "pending",
      payment: "",
      notes: form.message.trim()
    };
    
    try {
      const { error: dbError } = await supabase.from('participants').insert([newParticipant]);
      if (dbError) throw dbError;
      
      // -- AUTO TASKS GENERATOR --
      await supabase.from('tasks').insert([
        { task: `[Onboarding] Vérifier dossier & appeler ${newParticipant.prenom} ${newParticipant.nom}`, owner: 'alexis', priority: 'high', seminar: newParticipant.seminar },
        { task: `[Finance] Confirmer paiement de ${newParticipant.prenom} ${newParticipant.nom}`, owner: 'alexis', priority: 'medium', seminar: newParticipant.seminar }
      ]);
      
      // Send notifications
      try {
        await fetch('/api/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newParticipant)
        });
      } catch (notifyError) {
        console.error("Failed to send notifications:", notifyError);
        // We don't block the user if notifications fail, they are already registered
      }

      setSubmitted(true);
    } catch (error) {
      console.error("Error saving participant:", error);
      alert("Une erreur est survenue lors de l'inscription. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) return (
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF9F6", paddingTop: 80 }}>
      <div style={{ textAlign: "center", maxWidth: 500, padding: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "#1B2A4A", marginBottom: 12 }}>Demande envoyée !</h2>
        <p style={{ color: '#1B2A4A', fontSize: 16, lineHeight: 1.7 }}>Merci {form.prenom}. L'équipe RMK vous contactera sous 24h pour confirmer votre inscription et les modalités de paiement.</p>
        <p style={{ color: "#C9A84C", fontWeight: 600, fontSize: 14, marginTop: 16 }}>Vous recevrez un email de confirmation à {form.email}</p>
      </div>
    </section>
  );

  return (
    <section style={{ minHeight: "100vh", background: "#FAF9F6", paddingTop: 100, paddingBottom: 80 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ color: "#C9A84C", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Inscription</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1B2A4A", margin: "0 0 8px" }}>Réservez votre place</h2>
          <p style={{ color: '#1B2A4A', fontSize: 15 }}>Sélection exclusive par séminaire · Inscription confirmée après validation du paiement</p>
        </div>
        <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 20, padding: 36, border: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Nom *</label><input id="field-nom" style={{...inputStyle, background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: errors.nom ? "#E74C3C" : "rgba(0,0,0,0.1)"}} value={form.nom} onChange={upd("nom")} placeholder="Votre nom" />{errors.nom && <div style={errorStyle}>{errors.nom}</div>}</div>
            <div><label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Prénom *</label><input id="field-prenom" style={{...inputStyle, background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: errors.prenom ? "#E74C3C" : "rgba(0,0,0,0.1)"}} value={form.prenom} onChange={upd("prenom")} placeholder="Votre prénom" />{errors.prenom && <div style={errorStyle}>{errors.prenom}</div>}</div>
          </div>
          <div style={{ marginTop: 16 }}><label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Email professionnel *</label><input id="field-email" type="email" style={{...inputStyle, background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: errors.email ? "#E74C3C" : "rgba(0,0,0,0.1)"}} value={form.email} onChange={upd("email")} placeholder="email@entreprise.com" />{errors.email && <div style={errorStyle}>{errors.email}</div>}</div>
          <div style={{ marginTop: 16 }}><label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Téléphone (WhatsApp de préférence)</label><input id="field-tel" style={{...inputStyle, background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: errors.tel ? "#E74C3C" : "rgba(0,0,0,0.1)"}} value={form.tel} onChange={upd("tel")} placeholder="+225 07 02 61 15 82" />{errors.tel && <div style={errorStyle}>{errors.tel}</div>}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <div><label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Société *</label><input id="field-societe" style={{...inputStyle, background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: errors.societe ? "#E74C3C" : "rgba(0,0,0,0.1)"}} value={form.societe} onChange={upd("societe")} placeholder="Nom de l'entreprise" />{errors.societe && <div style={errorStyle}>{errors.societe}</div>}</div>
            <div><label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Fonction *</label><input id="field-fonction" style={{...inputStyle, background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: errors.fonction ? "#E74C3C" : "rgba(0,0,0,0.1)"}} value={form.fonction} onChange={upd("fonction")} placeholder="Directeur Financier..." />{errors.fonction && <div style={errorStyle}>{errors.fonction}</div>}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Séminaire souhaité *</label>
            <select id="field-seminaire" style={{ ...inputStyle, cursor: "pointer", background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: errors.seminaire ? "#E74C3C" : "rgba(0,0,0,0.1)" }} value={form.seminaire} onChange={upd("seminaire")}>
              <option value="" style={{ color: "#000" }}>-- Choisir un séminaire --</option>
              {seminars.map((s: any) => <option key={s.id} value={s.id} style={{ color: "#000" }}>{s.code} – {s.title} ({s.week})</option>)}
              <option value="pack2" style={{ color: "#000" }}>📦 Pack 2 séminaires (au choix)</option>
              <option value="pack4" style={{ color: "#000" }}>📦 Pack 4 séminaires (-20%)</option>
            </select>
            {errors.seminaire && <div style={errorStyle}>{errors.seminaire}</div>}
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 6 }}>Message (optionnel)</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", background: "rgba(0,0,0,0.05)", color: "#1B2A4A", borderColor: "rgba(0,0,0,0.1)" }} value={form.message} onChange={upd("message")} placeholder="Besoins spécifiques, questions..." />
          </div>
          
          <div style={{ marginTop: 20, padding: 16, background: "rgba(201,168,76,0.1)", borderRadius: 10, border: "1px solid rgba(201,168,76,0.3)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C" }}>🔥 Offre Early Bird : -10% avant le 30 avril 2026</div>
            <div style={{ fontSize: 12, color: '#1B2A4A', marginTop: 4 }}>Payez {fmt(prices?.earlyBird || EARLY_BIRD_PRICE)} FCFA au lieu de {fmt(prices?.standard || PRICE)} FCFA · Économisez {fmt((prices?.standard || PRICE) - (prices?.earlyBird || EARLY_BIRD_PRICE))} FCFA</div>
          </div>
          
          <button onClick={handleSubmit} disabled={isSubmitting} style={{
            width: "100%", marginTop: 24, padding: "16px 0", borderRadius: 12, background: isSubmitting ? "rgba(0,0,0,0.1)" : "linear-gradient(135deg, #C9A84C, #A88A3D)",
            color: isSubmitting ? "rgba(0,0,0,0.5)" : "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer", boxShadow: isSubmitting ? "none" : "0 4px 24px rgba(201,168,76,0.3)",
          }}>{isSubmitting ? "Envoi en cours..." : "Envoyer ma demande d'inscription"}</button>
          <p style={{ textAlign: "center", fontSize: 12, color: '#1B2A4A', marginTop: 12 }}>En soumettant ce formulaire, vous serez contacté par l'équipe RMK pour finaliser votre inscription.</p>
        </div>
      </div>
    </section>
  );
}

function Footer({ setPage }: { setPage: (p: string) => void }) {
  const navigate = useNavigate();
  return (
    <footer style={{ background: "#0B1120", padding: "48px 24px 24px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <LogoRMK scale={0.5} variant="dark" />
              <span style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15 }}>RMK CONSEILS</span>
            </div>
            <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.7 }}>Organisé par RMK Conseils à Abidjan.</p>
          </div>
          <div>
            <div style={{ color: "#94A3B8", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Navigation</div>
            {["home", "seminaires", "tarifs", "inscription"].map((p) => (
              <div key={p} style={{ marginBottom: 8 }}>
                <button onClick={() => { setPage(p); window.scrollTo(0, 0); }} style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: 0 }}>
                  {p === "home" ? "Accueil" : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              </div>
            ))}
            <div style={{ marginBottom: 8 }}>
                <button onClick={() => navigate('/portal')} style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: 0 }}>
                  Portail Client
                </button>
            </div>
          </div>
          <div>
            <div style={{ color: "#94A3B8", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Contact</div>
            <div style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 2 }}>
              📧 contact@rmkconsulting.pro<br />
              📧 rkedem@rmkconsulting.pro<br />
              📱 +225 07 02 61 15 82 WhatsApp
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ color: '#1B2A4A', fontSize: 12 }}>© 2026 RMK Conseils · Tous droits réservés</div>
          <div style={{ color: '#1B2A4A', fontSize: 12 }}>Formation délivrée par RMK Conseils</div>
        </div>
      </div>
    </footer>
  );
}

// ─── LEAD MAGNET ───
function ContactLead() {
  const [lead, setLead] = useState({ nom: "", contact: "", source: "Téléchargement Brochure" });
  const [sent, setSent] = useState(false);

  const saveLead = async () => {
    if (!lead.nom || !lead.contact) return;
    await supabase.from('leads').insert([lead]);
    await supabase.from('tasks').insert([{ task: `[Commercial] Rappeler le prospect ${lead.nom} (Contact: ${lead.contact})`, owner: 'alexis', priority: 'high', seminar: 'all' }]);
    setSent(true);
  };

  if (sent) return (
    <section style={{ padding: "60px 24px", background: "#1B2A4A", textAlign: "center" }}>
      <div style={{ color: "#27AE60", fontSize: 40, marginBottom: 12 }}>✓</div>
      <h3 style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Demande bien reçue !</h3>
      <p style={{ color: "rgba(255,255,255,0.7)" }}>Notre équipe vous contactera très rapidement avec les informations demandées.</p>
    </section>
  );

  return (
    <section style={{ padding: "80px 24px", background: "#1B2A4A", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h3 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Pas encore décidé ? Recevez la brochure complète.</h3>
        <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 32 }}>Laissez-nous vos coordonnées. Un conseiller RMK vous rappellera pour répondre à vos questions et vous envoyer le PDF détaillé du programme.</p>
        
        <div style={{ display: "flex", gap: 12, flexDirection: "column", maxWidth: 400, margin: "0 auto" }}>
          <input style={{ padding: "16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: 15 }} value={lead.nom} onChange={e => setLead({...lead, nom: e.target.value})} placeholder="Votre Nom & Prénom" />
          <input style={{ padding: "16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: 15 }} value={lead.contact} onChange={e => setLead({...lead, contact: e.target.value})} placeholder="Numéro de téléphone / Email" />
          <button onClick={saveLead} style={{ background: "#C9A84C", color: "#1B2A4A", border: "none", padding: "16px", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>M'envoyer la brochure</button>
        </div>
      </div>
    </section>
  );
}

// ─── MAIN APP ───

export default function LandingPage() {
  const [page, setPage] = useState("home");
  const [selectedSem, setSelectedSem] = useState("");
  const [seminars, setSeminars] = useState<Seminar[]>(SEMINARS);

  useEffect(() => {
    const fetchSeminars = async () => {
      const { data, error } = await supabase.from('seminars').select('*').order('code');
      if (!error && data && data.length > 0) {
        setSeminars(data);
      }
    };
    fetchSeminars();
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", margin: 0, minHeight: "100vh", background: "#FAF9F6" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        * { box-sizing: border-box; margin: 0; }
        html { scroll-behavior: smooth; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        input:focus, select:focus, textarea:focus { border-color: #C9A84C !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        button:hover { opacity: 0.92; transform: translateY(-1px); }
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .nav-mobile-btn { display: none !important; }
        }
      `}</style>
      <Nav page={page} setPage={setPage} />
      
      {page === "home" && (
        <>
          <Hero setPage={setPage} seminars={seminars} />
          <FormatSection />
          <section style={{ background: "#FAF9F6", padding: "80px 24px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <div style={{ color: "#C9A84C", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Séminaires</div>
                <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1B2A4A", margin: 0 }}>Choisissez votre séminaire</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: 24 }}>
                {seminars.map((s: Seminar, i: number) => (
                  <SeminarCard key={s.id} sem={s} delay={i * 100} onSelect={(id: string) => { setSelectedSem(id); setPage("inscription"); window.scrollTo(0, 0); }} />
                ))}
              </div>
            </div>
          </section>
          <section style={{ background: "linear-gradient(135deg, #C9A84C, #A88A3D)", padding: "64px 24px", textAlign: "center" }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: "#1B2A4A", marginBottom: 16 }}>Prêt à maîtriser l'IA ?</h2>
            <p style={{ color: "#1B2A4A", fontSize: 16, marginBottom: 32, maxWidth: 500, margin: "0 auto 32px" }}>Les dirigeants qui maîtrisent l'intelligence artificielle remplaceront ceux qui ne la maîtrisent pas.</p>
            <button onClick={() => { setPage("inscription"); window.scrollTo(0, 0); }} style={{
              background: "#fff", color: "#C9A84C", border: "none", padding: "16px 40px",
              borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            }}>S'inscrire maintenant →</button>
          </section>
        </>
      )}
      
      {page === "seminaires" && <SeminarsPage setPage={setPage} seminars={seminars} setSelectedSem={setSelectedSem} />}
      {page === "tarifs" && <PricingPage setPage={setPage} seminars={seminars} setSelectedSem={setSelectedSem} />}
      {page === "inscription" && <InscriptionPage selectedSem={selectedSem} seminars={seminars} />}
      {page === "home" && <ContactLead />}
      <Footer setPage={setPage} />
    </div>
  );
}
