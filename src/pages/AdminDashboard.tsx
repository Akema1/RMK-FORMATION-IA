import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "../lib/store";
import { supabase } from "../lib/supabaseClient";
import { COMMERCIAL_STRATEGY } from "../lib/strategy";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import autoTable from "jspdf-autotable";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ─── DATA & CONFIG ───
// ─── TYPES ───
interface Seminar {
  id: string;
  code: string;
  title: string;
  week: string;
  icon: string;
  color: string;
  seats: number;
  targets: string[];
  sectors: string[];
  flyer_subtitle: string;
  flyer_highlight: string;
  flyer_bullets: string[];
  flyer_image: string;
}

const DEFAULT_SEMINARS: Seminar[] = [
  { id: "s1", code: "IA-FINANCE", title: "IA pour la Finance", week: "Semaine 1 (Mai 2026)", icon: "💰", color: "#3498DB", seats: 20, targets: ["Directeurs Financiers", "Comptables"], sectors: ["Banque", "Assurance"], flyer_subtitle: "Optimisez vos processus financiers", flyer_highlight: "L'IA au service de la performance", flyer_bullets: ["Analyse prédictive", "Automatisation", "Reporting"], flyer_image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f" },
  { id: "s2", code: "IA-STRAT", title: "IA Stratégique", week: "Semaine 2 (Mai 2026)", icon: "🎯", color: "#E67E22", seats: 20, targets: ["Top Management", "Conseil"], sectors: ["Gouvernance", "Startups"], flyer_subtitle: "Le futur de la stratégie d'entreprise", flyer_highlight: "Décidez plus vite, décidez mieux", flyer_bullets: ["Vision 2026", "Agents Autonomes", "Marché Africain"], flyer_image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f" },
  { id: "s3", code: "IA-TECH", title: "IA Technique", week: "Semaine 3 (Mai 2026)", icon: "⚙️", color: "#27AE60", seats: 20, targets: ["CTO", "Développeurs"], sectors: ["IT", "Telecom"], flyer_subtitle: "Maîtrisez les outils de demain", flyer_highlight: "Du concept à la production", flyer_bullets: ["Python & AI", "LLM Fine-tuning", "Prompt Engineering"], flyer_image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c" },
  { id: "s4", code: "IA-RH-MKT", title: "IA RH & Marketing", week: "Semaine 4 (Mai 2026)", icon: "📣", color: "#9B59B6", seats: 20, targets: ["RH", "Marketing"], sectors: ["Services", "Commerce"], flyer_subtitle: "Boostez votre productivité humaine", flyer_highlight: "L'IA qui comprend l'humain", flyer_bullets: ["Recrutement IA", "Contenu Viral", "Analyse de sentiment"], flyer_image: "https://images.unsplash.com/photo-1552664730-d307ca884978" }
];

const DEFAULT_PRICES = { standard: 600000, earlyBird: 540000, discountPct: 10 };
const TEAM = [
  { id:"alexis", name:"Alexis", role:"Formateur CABEXIA + Stratégie RMK", avatar:"🧑‍💼" },
  { id:"rosine", name:"Rosine", role:"Opérations & Commercial RMK", avatar:"👩‍💼" },
];
const fmt = (n: number) => typeof n === 'number' ? n.toLocaleString("fr-FR") : n;

// ─── AI AGENT HELPER ───
async function callGemini(systemPrompt: string, userPrompt: string, seminars: Seminar[], useSearch = false, tools?: any[]) {
  try {
    let messages: any[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
    
    for (let i = 0; i < 5; i++) {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, messages, tools })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      if (data.functionCalls && data.functionCalls.length > 0) {
        messages.push({ role: 'model', parts: [{ functionCall: data.functionCalls[0] }] });
        
        const call = data.functionCalls[0];
        if (call.name === 'check_seminar_stats') {
          const { seminarCode } = call.args;
          const s = seminars.find(x => x.code.toLowerCase() === seminarCode.toLowerCase());
          if (s) {
            const { data: participants } = await supabase.from('participants').select('*').eq('seminar', s.id);
            const confirmed = participants ? participants.filter(d => d.status === "confirmed").length : 0;
            const result = `STATS ${s.code}: ${participants?.length || 0} inscrits, ${confirmed} confirmés, ${s.seats} places max.`;
            
            messages.push({
              role: 'user',
              parts: [{ functionResponse: { name: call.name, response: { result } } }]
            });
          } else {
            messages.push({
              role: 'user',
              parts: [{ functionResponse: { name: call.name, response: { error: "Séminaire non trouvé" } } }]
            });
          }
        }
      } else {
        return { text: data.text, functionCalls: null };
      }
    }
    return { text: "Max iterations reached", functionCalls: null };
  } catch (e: any) {
    return { text: `Erreur: ${e.message}`, functionCalls: null };
  }
}

// ─── STYLES ───
const NAVY = "#FAF9F6";
import { LogoRMK } from "../components/LogoRMK";

const ORANGE = "#C9A84C";
const card = { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: 24 };
const inputS = { width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid rgba(0,0,0,0.12)", fontSize:14, fontFamily:"inherit", background:"rgba(0,0,0,0.06)", color:"#1B2A4A", outline:"none", boxSizing:"border-box" } as React.CSSProperties;
const selectS = { ...inputS, cursor:"pointer" } as React.CSSProperties;
const btnPrimary = { background:`linear-gradient(135deg,${ORANGE},#A88A3D)`, color:"#fff", border:"none", padding:"12px 24px", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.2s" };
const btnSecondary = { background:"rgba(0,0,0,0.06)", color:"#1B2A4A", border:"1px solid rgba(0,0,0,0.12)", padding:"10px 20px", borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer" };
const badge = (color: string) => ({ display:"inline-block", padding:"3px 10px", borderRadius:100, fontSize:11, fontWeight:700, background:`${color}22`, color });
const label = { fontSize:12, fontWeight:600, color: '#1B2A4A', display:"block", marginBottom:6, letterSpacing:0.5, textTransform:"uppercase" } as React.CSSProperties;

// ─── NAV ───
function Nav({ page, setPage }: any) {
  const navigate = useNavigate();
  const tabs = [
    { key:"dashboard", label:"Dashboard", icon:"📊" },
    { key:"seminaires", label:"Séminaires", icon:"🏢" },
    { key:"inscriptions", label:"Inscriptions", icon:"📋" },
    { key:"leads", label:"Leads & Prospects", icon:"🎯" },
    { key:"finance", label:"Finance", icon:"💰" },
    { key:"tasks", label:"Tâches", icon:"✅" },
    { key:"prices", label:"Tarifs", icon:"🏷️" },
    { key:"agent", label:"Agent Commercial", icon:"🤖" },
    { key:"seo", label:"Agent SEO", icon:"🔍" },
    { key:"flyer", label:"Flyer", icon:"📄" },
  ];
  return (
    <nav style={{ position:"fixed", top:0, left:0, bottom:0, width:220, background:"#1B2A4A", borderRight:"1px solid rgba(255,255,255,0.06)", zIndex:100, display:"flex", flexDirection:"column", padding:"16px 0", overflowY:"auto" }}>
      <div style={{ padding:"8px 20px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, cursor: "pointer" }} onClick={() => navigate('/')}>
          <LogoRMK scale={0.4} variant="dark" />
          <div>
            <div style={{ color:"#FAF9F6", fontWeight:700, fontSize:14 }}>RMK CONSEILS</div>
            <div style={{ color:"rgba(250,249,246,0.6)", fontSize:10, letterSpacing:1 }}>ADMIN · MAI 2026</div>
          </div>
        </div>
      </div>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setPage(t.key)} style={{
          display:"flex", alignItems:"center", gap:10, padding:"11px 20px", margin:"2px 8px",
          background: page===t.key ? "rgba(201,168,76,0.15)" : "transparent",
          border:"none", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight: page===t.key ? 700 : 500,
          color: page===t.key ? ORANGE : "rgba(250,249,246,0.65)", transition:"all 0.2s", textAlign:"left",
          borderLeft: page===t.key ? `3px solid ${ORANGE}` : "3px solid transparent",
        }}><span style={{ fontSize:16 }}>{t.icon}</span> {t.label}</button>
      ))}
      <div style={{ marginTop:"auto", padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        {TEAM.map(m => (
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0" }}>
            <span style={{ fontSize:18 }}>{m.avatar}</span>
            <div><div style={{ color:"#FAF9F6", fontSize:12, fontWeight:600 }}>{m.name}</div><div style={{ color:"rgba(250,249,246,0.5)", fontSize:10 }}>{m.role.split("+")[0].trim()}</div></div>
          </div>
        ))}
      </div>
    </nav>
  );
}

// ─── DASHBOARD ───
function DashboardPage({ participants, prices, tasks, leads, seminars }: any) {
  const confirmed = participants.filter((p: any) => p.status === "confirmed");
  const totalRev = confirmed.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalSeats = seminars.reduce((s: any, x: any) => s + x.seats, 0);
  const target = totalSeats * prices.standard;
  
  const pendingTasks = tasks?.filter((t: any) => t.status !== "done") || [];
  const hotLeads = leads?.filter((l: any) => l.status === "chaud") || [];
  
  return (
    <div>
      <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:"0 0 24px" }}>Tableau de bord complet</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:32 }}>
        {[
          { label:"Inscrits", val:participants.length, sub:`/ ${totalSeats} places`, color:ORANGE, pct:participants.length/totalSeats*100 },
          { label:"Confirmés", val:confirmed.length, sub:`/ ${participants.length} inscrits`, color:"#27AE60", pct: participants.length ? confirmed.length/participants.length*100 : 0 },
          { label:"Revenus encaissés", val:`${(totalRev/1e6).toFixed(1)}M`, sub:`obj. ${(target/1e6).toFixed(0)}M FCFA`, color:"#2980B9", pct:totalRev/target*100 },
          { label:"Taux remplissage", val:`${Math.round(participants.length/totalSeats*100)}%`, sub:"objectif 85%", color:"#F39C12", pct:participants.length/totalSeats*100 },
          { label:"Leads Chauds", val:hotLeads.length, sub:`/ ${leads?.length || 0} prospects`, color:"#E74C3C", pct: leads?.length ? hotLeads.length/leads.length*100 : 0 },
          { label:"Tâches en cours", val:pendingTasks.length, sub:`/ ${tasks?.length || 0} total`, color:"#8E44AD", pct: tasks?.length ? (tasks.length - pendingTasks.length)/tasks.length*100 : 0 },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize:11, color: '#1B2A4A', letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:"#1B2A4A" }}>{k.val} <span style={{ fontSize:12, fontWeight:400, color: '#1B2A4A' }}>{k.sub}</span></div>
            <div style={{ marginTop:12, height:4, borderRadius:2, background:"rgba(0,0,0,0.08)" }}>
              <div style={{ height:"100%", borderRadius:2, background:k.color, width:`${Math.min(k.pct,100)}%`, transition:"width 0.8s" }} />
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>Par séminaire</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16 }}>
        {seminars.map((s: any) => {
          const sp = participants.filter((p: any) => p.seminar === s.id);
          const sc = sp.filter((p: any) => p.status === "confirmed");
          return (
            <div key={s.id} style={{ ...card, borderTop:`3px solid ${s.color}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:22 }}>{s.icon}</span>
                <span style={badge(s.color)}>{s.code}</span>
              </div>
              <div style={{ color:"#1B2A4A", fontWeight:700, fontSize:14, marginBottom:8 }}>{s.title}</div>
              <div style={{ color: '#1B2A4A', fontSize:12, marginBottom:12 }}>{s.week}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div><div style={{ fontSize:20, fontWeight:800, color:"#1B2A4A" }}>{sp.length}<span style={{ fontSize:11, color: '#1B2A4A' }}>/{s.seats}</span></div><div style={{ fontSize:10, color: '#1B2A4A' }}>Inscrits</div></div>
                <div><div style={{ fontSize:20, fontWeight:800, color:"#27AE60" }}>{sc.length}</div><div style={{ fontSize:10, color: '#1B2A4A' }}>Confirmés</div></div>
              </div>
              <div style={{ marginTop:12, height:5, borderRadius:3, background:"rgba(0,0,0,0.08)" }}>
                <div style={{ height:"100%", borderRadius:3, background:s.color, width:`${(sp.length/s.seats)*100}%` }} />
              </div>
              <div style={{ fontSize:11, color: '#1B2A4A', marginTop:6 }}>{fmt(sc.reduce((a: number,p: any)=>a+(p.amount||0),0))} FCFA encaissé</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SEO AGENT ───
function SeoAgentPage({ seminars }: { seminars: Seminar[] }) {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('rmk_seo_history') || '[]'); } catch { return []; }
  });

  const generateSEO = async () => {
    if (!topic) return;
    setLoading(true);
    const prompt = `Tu es un expert SEO spécialisé dans la formation professionnelle B2B en Afrique (spécifiquement Côte d'Ivoire).
    Génère une stratégie SEO pour le sujet suivant : "${topic}".
    Inclus :
    1. 5 Mots-clés principaux (avec volume estimé et difficulté)
    2. 3 Idées de titres d'articles de blog accrocheurs
    3. Une meta description optimisée (max 160 caractères)
    4. Un plan de contenu (H1, H2, H3) pour une page d'atterrissage.`;
    
    const res = await callGemini("Tu es un expert SEO B2B.", prompt, seminars);
    setResult(res.text);
    const newHistory = [{ date: new Date().toLocaleString("fr-FR"), topic, result: res.text }, ...history.slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('rmk_seo_history', JSON.stringify(newHistory));
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:"0 0 24px" }}>Agent SEO & Contenu</h2>
      <div style={{ ...card, marginBottom:24 }}>
        <p style={{ color: '#1B2A4A', fontSize:14, marginBottom:16 }}>L'Agent SEO vous aide à générer des mots-clés, des idées d'articles et des structures de pages pour attirer plus de prospects organiques sur vos séminaires.</p>
        <div style={{ display:"flex", gap:12 }}>
          <input style={{ ...inputS, flex:1 }} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Formation IA pour les Directeurs Financiers à Abidjan" />
          <button onClick={generateSEO} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Génération..." : "Générer Stratégie SEO"}
          </button>
        </div>
      </div>
      {result && (
        <div style={{ ...card, background:"rgba(0,0,0,0.02)", marginBottom: 24 }}>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>Résultat SEO</h3>
          <div style={{ color: "#1B2A4A", fontSize:14, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{result}</div>
        </div>
      )}
      {history.length > 0 && (
        <>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:12 }}>Historique SEO</h3>
          {history.map((h, i) => (
            <details key={i} style={{ ...card, marginBottom:8, cursor:"pointer" }}>
              <summary style={{ color:"#1B2A4A", fontSize:13, fontWeight:600 }}>{h.date} – {h.topic}</summary>
              <div style={{ color: '#1B2A4A', fontSize:13, lineHeight:1.7, marginTop:12, whiteSpace:"pre-wrap" }}>{h.result}</div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}

// ─── FLYER GENERATOR ───
function FlyerPage({ seminars }: { seminars: Seminar[] }) {
  const [flyerId, setFlyerId] = useState(seminars[0]?.id || "s1");
  const [customImage, setCustomImage] = useState("");
  const flyerRef = useRef<HTMLDivElement>(null);
  const s = seminars.find(x => x.id === flyerId) || seminars[0];

  if (!s) return <div style={{ padding: 24, color: '#1B2A4A' }}>Aucun sminaire disponible pour le flyer.</div>;

  const finalImage = customImage || s.flyer_image;

  const exportPNG = async () => {
    if (!flyerRef.current) return;
    const canvas = await html2canvas(flyerRef.current, { scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = `Flyer_RMK_${s.code}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const exportPDF = async () => {
    if (!flyerRef.current) return;
    const canvas = await html2canvas(flyerRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ format: [1000, 1000], unit: "px" });
    pdf.addImage(imgData, "PNG", 0, 0, 1000, 1000);
    pdf.save(`Flyer_RMK_${s.code}.pdf`);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:0 }}>Générateur de Flyer Individuel</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <select style={{ ...selectS, width: "auto" }} value={flyerId} onChange={e => setFlyerId(e.target.value)}>
            {seminars.map(sem => <option key={sem.id} value={sem.id}>{sem.code} - {sem.title}</option>)}
          </select>
          <button onClick={exportPNG} style={{ ...btnPrimary, background: "#2980B9" }}>🖼️ Exporter PNG</button>
          <button onClick={exportPDF} style={btnPrimary}>🖨️ Exporter PDF</button>
        </div>
      </div>
      
      <div style={{ background: "rgba(0,0,0,0.05)", padding: 16, borderRadius: 8, marginBottom: 24, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", color: '#1B2A4A', fontSize: 12, marginBottom: 4 }}>URL de l'image personnalisée (optionnel)</label>
          <input 
            type="text" 
            value={customImage} 
            onChange={e => setCustomImage(e.target.value)} 
            placeholder="Collez le lien d'une image ici pour remplacer celle par défaut..."
            style={{ ...inputS, width: "100%" }}
          />
        </div>
        <p style={{ color: '#1B2A4A', fontSize:12, margin: 0, maxWidth: 300 }}>
          Cliquez sur les boutons d'export ci-dessus pour générer une image ou un PDF parfaitement dimensionné (1000x1000).
        </p>
      </div>
      
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div ref={flyerRef} className="printable-flyer" style={{ width: 1000, height: 1000, background: "#FAF9F6", position: "relative", overflow: "hidden", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 20px 50px rgba(0,0,0,0.5)", borderRadius: 8 }}>
          
          {/* Background decorations */}
          <div style={{ position: "absolute", top: -150, left: -150, width: 400, height: 400, background: "radial-gradient(circle, rgba(96,224,224,0.15) 0%, rgba(0,0,0,0) 70%)" }} />
          <div style={{ position: "absolute", top: 100, right: 100, width: 600, height: 600, background: "radial-gradient(circle, rgba(96,224,224,0.05) 0%, rgba(0,0,0,0) 70%)" }} />

          {/* Right Image (Person) */}
          <div style={{ position: "absolute", right: 0, bottom: 0, width: 450, height: "85%", backgroundImage: `url(${finalImage})`, backgroundSize: "cover", backgroundPosition: "center top", borderTopLeftRadius: 400, borderBottomLeftRadius: 0, boxShadow: "-10px 0 40px rgba(0,0,0,0.5)", zIndex: 5 }} />

          {/* Content Container */}
          <div style={{ position: "relative", zIndex: 10, padding: "40px 50px", width: "65%", height: "100%", display: "flex", flexDirection: "column" }}>
            
            {/* Logos */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
              <LogoRMK scale={1} variant="light" />
              <span style={{ fontSize:24, color:"#C9A84C" }}>×</span>
              <div style={{ color: "#60E0E0", fontSize: 28, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                CABEXIA
              </div>
            </div>

            {/* Titles */}
            <div contentEditable suppressContentEditableWarning style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 28, color: "#1B2A4A", marginBottom: -5 }}>Atelier de Formation</div>
            <div contentEditable suppressContentEditableWarning style={{ fontSize: 42, fontWeight: 900, color: "#1B2A4A", letterSpacing: 2, lineHeight: 1, textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>INTELLIGENCE</div>
            <div contentEditable suppressContentEditableWarning style={{ fontSize: 24, fontWeight: 700, color: "#60E0E0", letterSpacing: 8, marginBottom: 16, textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>ARTIFICIELLE</div>
            <div contentEditable suppressContentEditableWarning style={{ fontSize: 18, fontWeight: 600, color: "#1A2332", marginBottom: 12 }}>{s.flyer_subtitle}</div>
            
            {/* Target Audience */}
            <div contentEditable suppressContentEditableWarning style={{ fontSize: 13, fontWeight: 500, color: "#1B2A4A", marginBottom: 20, lineHeight: 1.5, maxWidth: "90%" }}>
              Pour Managers, Dirigeants, Administrateurs, Consultants, Entrepreneurs, Cadres Supérieurs et Professionnels souhaitant accélérer leur transformation digitale et renforcer leurs décisions stratégiques.
            </div>

            {/* Highlight Box */}
            <div contentEditable suppressContentEditableWarning style={{ background: "#60E0E0", color: "#1B2A4A", padding: "16px 30px", fontSize: 16, fontWeight: 800, borderRadius: "0 20px 20px 0", marginLeft: -50, paddingLeft: 50, marginBottom: 20, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}>
              {s.flyer_highlight}
            </div>

            {/* Bullets */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {s.flyer_bullets?.map((b: string, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, fontWeight: 600, color: "#1B2A4A" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60E0E0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  <span contentEditable suppressContentEditableWarning>{b}</span>
                </div>
              ))}
            </div>

            {/* Format */}
            <div contentEditable suppressContentEditableWarning style={{ fontSize: 18, fontWeight: 700, color: "#1B2A4A", fontStyle: "italic", marginBottom: 24 }}>
              3 Sessions présentielles + 2 en ligne
            </div>

            {/* Location & Date */}
            <div style={{ display: "flex", gap: 40, marginBottom: 30 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60E0E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <div>
                  <div contentEditable suppressContentEditableWarning style={{ fontSize: 18, fontWeight: 800, color: "#1B2A4A" }}>Hôtel Movenpick</div>
                  <div contentEditable suppressContentEditableWarning style={{ fontSize: 16, color: "#1A2332" }}>Abidjan-Côte d'Ivoire</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60E0E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <div>
                  <div contentEditable suppressContentEditableWarning style={{ fontSize: 18, fontWeight: 800, color: "#1B2A4A" }}>{s.week}</div>
                  <div contentEditable suppressContentEditableWarning style={{ fontSize: 16, color: "#1A2332" }}>(+ dates sessions sectorielles)</div>
                </div>
              </div>
            </div>

            {/* S'inscrire */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: "auto", paddingBottom: 40 }}>
              <div style={{ background: "#60E0E0", color: "#1B2A4A", padding: "12px 24px", fontSize: 18, fontWeight: 800, borderRadius: 8 }}>
                S'inscrire
              </div>
              <div style={{ width: 60, height: 60, background: "#fff", padding: 4, borderRadius: 4 }}>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://rmk-cabexia.com/inscription" alt="QR Code" style={{ width: "100%", height: "100%" }} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 80, background: "#fff", padding: "0 40px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1B2A4A", fontSize: 16, fontWeight: 700 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              +225 07 02 61 15 82
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1B2A4A", fontSize: 16, fontWeight: 700 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              rmk-cabexia.com/inscription
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1B2A4A", fontSize: 16, fontWeight: 700 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              rkedem@rmkconsulting.pro
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .printable-flyer, .printable-flyer * { visibility: visible; }
          .printable-flyer { position: absolute; left: 0; top: 0; width: 1000px; height: 1000px; box-shadow: none; border-radius: 0; }
        }
      `}} />
    </div>
  );
}

// ─── SEMINARS MANAGEMENT ───
function SeminarsManagement({ seminars, refreshSeminars }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Seminar>>({ code:"", title:"", week:"", icon:"📚", color:"#C9A84C", seats:20 });
  
  const upd = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const saveSeminar = async () => {
    if (!form.code || !form.title) return;
    
    // Parse comma-separated strings into arrays if they are strings
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
    setForm({ code:"", title:"", week:"", icon:"📚", color:"#C9A84C", seats:20 });
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
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:0 }}>Gestion des Séminaires</h2>
        <button onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null); }} style={btnPrimary}>{showForm ? "✕ Fermer" : "+ Nouveau Séminaire"}</button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom:24, borderLeft:`3px solid ${ORANGE}` }}>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>{editingId ? "Modifier le séminaire" : "Ajouter un séminaire"}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div><label style={label}>Code (ex: S1)</label><input style={inputS} value={form.code} onChange={upd("code")} /></div>
            <div><label style={label}>Titre</label><input style={inputS} value={form.title} onChange={upd("title")} /></div>
            <div><label style={label}>Dates (ex: 12-16 Mai 2026)</label><input style={inputS} value={form.week} onChange={upd("week")} /></div>
            <div><label style={label}>Icon (Emoji)</label><input style={inputS} value={form.icon} onChange={upd("icon")} /></div>
            <div><label style={label}>Couleur (Hex)</label><input style={inputS} value={form.color} onChange={upd("color")} /></div>
            <div><label style={label}>Places Disponibles</label><input type="number" style={inputS} value={form.seats} onChange={upd("seats")} /></div>
          </div>
          
          <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, color: ORANGE, fontWeight: 700, marginBottom: 12 }}>Détails Flyer & Marketing</h4>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={label}>Sous-titre Flyer</label><input style={inputS} value={form.flyer_subtitle} onChange={upd("flyer_subtitle")} placeholder="Ex: IAG Stratégique..." /></div>
              <div><label style={label}>Image Flyer (URL)</label><input style={inputS} value={form.flyer_image} onChange={upd("flyer_image")} placeholder="https://..." /></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={label}>Highlight (Accroche)</label>
              <textarea style={{ ...inputS, height: 60 }} value={form.flyer_highlight} onChange={upd("flyer_highlight")} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop: 12 }}>
              <div><label style={label}>Points clés (séparés par des virgules)</label><textarea style={{ ...inputS, height: 80 }} value={Array.isArray(form.flyer_bullets) ? form.flyer_bullets.join(', ') : form.flyer_bullets} onChange={upd("flyer_bullets")} /></div>
              <div><label style={label}>Cibles (séparées par des virgules)</label><textarea style={{ ...inputS, height: 80 }} value={Array.isArray(form.targets) ? form.targets.join(', ') : form.targets} onChange={upd("targets")} /></div>
              <div><label style={label}>Secteurs (séparés par des virgules)</label><textarea style={{ ...inputS, height: 80 }} value={Array.isArray(form.sectors) ? form.sectors.join(', ') : form.sectors} onChange={upd("sectors")} /></div>
            </div>
          </div>
          <button onClick={saveSeminar} style={{ ...btnPrimary, marginTop:16 }}>✓ Enregistrer</button>
        </div>
      )}

      <div style={{ ...card, padding:0, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"0.5fr 3fr 2fr 1fr 1fr", padding:"12px 16px", background:"rgba(0,0,0,0.02)", borderBottom:"1px solid rgba(0,0,0,0.06)", fontSize:11, fontWeight:700, color:"rgba(0,0,0,0.4)", textTransform:"uppercase" }}>
          <div>Code</div><div>Titre</div><div>Dates</div><div>Places</div><div>Actions</div>
        </div>
        {seminars.map((s: Seminar) => (
          <div key={s.id} style={{ display:"grid", gridTemplateColumns:"0.5fr 3fr 2fr 1fr 1fr", padding:"14px 16px", borderBottom:"1px solid rgba(0,0,0,0.04)", alignItems:"center" }}>
            <div style={{ fontWeight:700, color:s.color }}>{s.code}</div>
            <div style={{ fontSize:13, fontWeight:600 }}>{s.icon} {s.title}</div>
            <div style={{ fontSize:12 }}>{s.week}</div>
            <div style={{ fontSize:12 }}>{s.seats} places</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => startEdit(s)} style={{ background:"none", border:"none", cursor:"pointer" }}>✏️</button>
              <button onClick={() => deleteSeminar(s.id)} style={{ background:"none", border:"none", cursor:"pointer" }}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── INSCRIPTIONS MANAGEMENT ───
function InscriptionsPage({ participants, seminars, refreshParticipants }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom:"", prenom:"", email:"", tel:"", societe:"", fonction:"", seminar:"", amount:0, status:"pending", payment:"", notes:"" });
  const [filter, setFilter] = useState("all");
  const upd = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const addParticipant = async () => {
    if (!form.nom || !form.seminar) return;
    if (editingId) {
      await supabase.from('participants').update({ ...form, amount: Number(form.amount) }).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('participants').insert([{ ...form, amount: Number(form.amount) }]);
    }
    refreshParticipants();
    setForm({ nom:"", prenom:"", email:"", tel:"", societe:"", fonction:"", seminar:"", amount:0, status:"pending", payment:"", notes:"" });
    setShowForm(false);
  };

  const startEdit = (p: any) => {
    setForm({ ...p });
    setEditingId(p.id);
    setShowForm(true);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('participants').update({ status }).eq('id', id);
    refreshParticipants();
  };

  const deleteParticipant = async (id: string) => {
    if (window.confirm("⚠️ Supprimer définitivement ?")) {
      await supabase.from('participants').delete().eq('id', id);
      refreshParticipants();
    }
  };

  const exportAttestation = (p: any, s: any) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Background / Border
    doc.setLineWidth(2);
    doc.setDrawColor(232, 101, 26); // ORANGE
    doc.rect(10, 10, 277, 190);
    
    // Header
    doc.setFontSize(30);
    doc.setTextColor(15, 23, 42); // NAVY
    doc.text("ATTESTATION DE FORMATION", 148.5, 40, { align: "center" });
    
    // Subtitle
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Délivrée par RMK Conseils & CABEXIA", 148.5, 55, { align: "center" });
    
    // Body
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Nous soussignés, certifions que :", 148.5, 80, { align: "center" });
    
    doc.setFontSize(24);
    doc.setTextColor(232, 101, 26); // ORANGE
    doc.text(`${p.prenom} ${p.nom}`.toUpperCase(), 148.5, 100, { align: "center" });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`a suivi avec succès le séminaire de formation :`, 148.5, 120, { align: "center" });
    
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // NAVY
    doc.text(s.title, 148.5, 135, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date : ${s.week} | Lieu : Hôtel Movenpick, Abidjan`, 148.5, 150, { align: "center" });
    
    // Signatures
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Le Directeur Général, RMK Conseils", 50, 180, { align: "center" });
    doc.text("L'Expert Formateur, CABEXIA", 247, 180, { align: "center" });
    
    doc.save(`Attestation_${p.nom}_${s.code}.pdf`);
  };

  const filtered = filter === "all" ? participants : participants.filter((p: any) => p.seminar === filter);
  const statusColors: any = { confirmed:"#27AE60", pending:"#F39C12", cancelled:"#E74C3C" };
  const statusLabels: any = { confirmed:"Confirmé", pending:"En attente", cancelled:"Annulé" };

  const exportCSV = () => {
    const headers = ["nom", "prenom", "email", "tel", "societe", "fonction", "seminar", "amount", "status", "payment", "notes", "created_at"];
    const rows = participants.map((p: any) => {
      const s = seminars.find((x: any) => x.id === p.seminar);
      return { ...p, seminar: s ? s.code : p.seminar };
    });
    const csvContent = [
      headers.join(","),
      ...rows.map((r: any) => headers.map(h => `"${(r[h] || "").toString().replace(/"/g, '""')}"`).join(","))
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
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:0 }}>Gestion des inscriptions</h2>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={exportCSV} style={{ ...btnSecondary, borderColor: "#27AE60", color: "#27AE60" }}>📊 Exporter CSV</button>
          <button onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null); }} style={btnPrimary}>{showForm ? "✕ Fermer" : "+ Nouvelle inscription"}</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom:24, borderLeft:`3px solid ${ORANGE}` }}>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>{editingId ? "Modifier l'inscription" : "Ajouter un participant"}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label style={label}>Nom *</label><input style={inputS} value={form.nom} onChange={upd("nom")} placeholder="Nom" /></div>
            <div><label style={label}>Prénom</label><input style={inputS} value={form.prenom} onChange={upd("prenom")} placeholder="Prénom" /></div>
            <div><label style={label}>Email</label><input style={inputS} value={form.email} onChange={upd("email")} placeholder="email@entreprise.com" /></div>
            <div><label style={label}>Téléphone</label><input style={inputS} value={form.tel} onChange={upd("tel")} placeholder="+225 07..." /></div>
            <div><label style={label}>Société</label><input style={inputS} value={form.societe} onChange={upd("societe")} placeholder="Nom entreprise" /></div>
            <div><label style={label}>Fonction</label><input style={inputS} value={form.fonction} onChange={upd("fonction")} placeholder="Directeur, DAF..." /></div>
            <div><label style={label}>Séminaire *</label>
              <select style={selectS} value={form.seminar} onChange={upd("seminar")}>
                <option value="">-- Choisir --</option>
                {seminars.map((s: any) => <option key={s.id} value={s.id}>{s.code} – {s.title}</option>)}
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
          <div style={{ marginTop:12 }}><label style={label}>Notes</label><input style={inputS} value={form.notes || ""} onChange={upd("notes")} placeholder="Notes internes..." /></div>
          <button onClick={addParticipant} style={{ ...btnPrimary, marginTop:16 }}>{editingId ? "✓ Enregistrer les modifications" : "✓ Enregistrer l'inscription"}</button>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        <button onClick={() => setFilter("all")} style={{ ...btnSecondary, background: filter==="all" ? `${ORANGE}22` : undefined, color: filter==="all" ? ORANGE : "rgba(0,0,0,0.5)" }}>Tous ({participants.length})</button>
        {seminars.map((s: any) => {
          const c = participants.filter((p: any) => p.seminar === s.id).length;
          return <button key={s.id} onClick={() => setFilter(s.id)} style={{ ...btnSecondary, background: filter===s.id ? `${s.color}22` : undefined, color: filter===s.id ? s.color : "rgba(0,0,0,0.5)", borderColor: filter===s.id ? `${s.color}44` : undefined }}>{s.code} ({c})</button>;
        })}
      </div>

      <div style={{ ...card, padding:0, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1.2fr 1.2fr 1fr 1fr 0.8fr", padding:"12px 16px", borderBottom:"1px solid rgba(0,0,0,0.08)" }}>
          {["Participant","Société / Fonction","Séminaire","Paiement","Montant","Statut",""].map(h => (
            <div key={h} style={{ fontSize:10, color: '#1B2A4A', textTransform:"uppercase", letterSpacing:1, fontWeight:700 }}>{h}</div>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ padding:32, textAlign:"center", color: '#1B2A4A', fontSize:14 }}>Aucune inscription pour le moment</div>}
        {filtered.map((p: any, i: number) => {
          const s = seminars.find((x: any) => x.id === p.seminar);
          return (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1.2fr 1.2fr 1fr 1fr 0.8fr", padding:"14px 16px", borderBottom:"1px solid rgba(0,0,0,0.04)", alignItems:"center" }}>
              <div><div style={{ color:"#1B2A4A", fontSize:13, fontWeight:600 }}>{p.nom} {p.prenom}</div><div style={{ color: '#1B2A4A', fontSize:11 }}>{p.email}</div></div>
              <div><div style={{ color: '#1B2A4A', fontSize:13 }}>{p.societe}</div><div style={{ color: '#1B2A4A', fontSize:11 }}>{p.fonction}</div></div>
              <div style={{ fontSize:12, color:s?.color || "#fff", fontWeight:600 }}>{s?.code} {s?.icon}</div>
              <div style={{ fontSize:12, color: '#1B2A4A', display: "flex", alignItems: "center", gap: 8 }}>
                {p.payment || "—"}
                {p.tel && (
                  <a href={`https://wa.me/${p.tel.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: "#25D366", textDecoration: "none", display: "flex", alignItems: "center", background: "rgba(37, 211, 102, 0.1)", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </a>
                )}
              </div>
              <div style={{ fontSize:13, color:"#1B2A4A", fontWeight:600 }}>{fmt(p.amount)} F</div>
              <div>
                <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)} style={{ background:`${statusColors[p.status]}22`, color:statusColors[p.status], border:"none", borderRadius:100, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  <option value="pending">En attente</option>
                  <option value="confirmed">Confirmé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => startEdit(p)} style={{ background:"none", border:"none", color:ORANGE, cursor:"pointer", fontSize:16 }} title="Modifier">✏️</button>
                {p.status === "confirmed" && (
                  <button onClick={() => exportAttestation(p, s)} style={{ background:"none", border:"none", color:"#3498DB", cursor:"pointer", fontSize:16 }} title="Exporter Attestation">🎓</button>
                )}
                <button onClick={() => deleteParticipant(p.id)} style={{ background:"none", border:"none", color:"#E74C3C", cursor:"pointer", fontSize:16 }} title="Supprimer">🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FINANCE ───
function FinancePage({ participants, seminars, prices, expenses, refreshExpenses }: any) {
  const [view, setView] = useState("global"); // 'global', 's1', 's2', 's3', 's4'
  const confirmed = participants.filter((p: any) => p.status === "confirmed");

  // Base constants from Excel
  const PLAN_PAX = 15;
  const PLAN_DAYS = 3;
  const PLAN_ONLINE_DAYS = 2;

  const calculateFinancials = (seminarId: string, isPlan: boolean) => {
    let qtyStandard = 0;
    let qtyEarlyBird = 0;
    let totalPax = 0;

    if (isPlan) {
      qtyStandard = 10;
      qtyEarlyBird = 5;
      totalPax = PLAN_PAX;
    } else {
      const semParticipants = seminarId === "global" ? confirmed : confirmed.filter((p: any) => p.seminar === seminarId);
      qtyStandard = semParticipants.filter((p: any) => p.amount >= prices.standard).length;
      qtyEarlyBird = semParticipants.filter((p: any) => p.amount < prices.standard).length;
      totalPax = semParticipants.length;
    }

    const revStandard = qtyStandard * prices.standard;
    const revEarlyBird = qtyEarlyBird * prices.earlyBird;
    const totalRevenus = revStandard + revEarlyBird;

    let charges = {
      consultance_pres: 0,
      consultance_ligne: 0,
      billet_avion: 0,
      sejour: 0,
      salle: 0,
      pauses_cafe: 0,
      dejeuner: 0,
      supports: 0,
      equipements: 0,
      divers: 0,
      transport: 0,
      commercialisation: 0,
    };

    if (isPlan) {
      charges = {
        consultance_pres: 1050000,
        consultance_ligne: 400000,
        billet_avion: 650000,
        sejour: 120000 * 4,
        salle: 150000 * 3,
        pauses_cafe: 10000 * 15 * 3,
        dejeuner: 15000 * 15 * 3,
        supports: 5000 * 15,
        equipements: 50000 * 3,
        divers: 100000,
        transport: 150000,
        commercialisation: totalRevenus * 0.1,
      };
    } else {
      const semExpenses = seminarId === "global" ? expenses : expenses.filter((e: any) => e.seminar === seminarId || e.seminar === "all");
      semExpenses.forEach((e: any) => {
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

    return {
      qtyStandard, qtyEarlyBird, totalPax,
      revStandard, revEarlyBird, totalRevenus,
      charges, totalCharges,
      revenuProv, imprevu, sousTotalBrut, tva, net
    };
  };

  let plan = calculateFinancials(view, true);
  let actual = calculateFinancials(view, false);

  if (view === "global") {
    const semPlans = seminars.map((s: any) => calculateFinancials(s.id, true));
    plan = {
      qtyStandard: semPlans.reduce((s:any, p:any) => s + p.qtyStandard, 0),
      qtyEarlyBird: semPlans.reduce((s:any, p:any) => s + p.qtyEarlyBird, 0),
      totalPax: semPlans.reduce((s:any, p:any) => s + p.totalPax, 0),
      revStandard: semPlans.reduce((s:any, p:any) => s + p.revStandard, 0),
      revEarlyBird: semPlans.reduce((s:any, p:any) => s + p.revEarlyBird, 0),
      totalRevenus: semPlans.reduce((s:any, p:any) => s + p.totalRevenus, 0),
      charges: {
        consultance_pres: semPlans.reduce((s:any, p:any) => s + p.charges.consultance_pres, 0),
        consultance_ligne: semPlans.reduce((s:any, p:any) => s + p.charges.consultance_ligne, 0),
        billet_avion: semPlans[0]?.charges.billet_avion || 0,
        sejour: semPlans.reduce((s:any, p:any) => s + p.charges.sejour, 0),
        salle: semPlans.reduce((s:any, p:any) => s + p.charges.salle, 0),
        pauses_cafe: semPlans.reduce((s:any, p:any) => s + p.charges.pauses_cafe, 0),
        dejeuner: semPlans.reduce((s:any, p:any) => s + p.charges.dejeuner, 0),
        supports: semPlans.reduce((s:any, p:any) => s + p.charges.supports, 0),
        equipements: semPlans.reduce((s:any, p:any) => s + p.charges.equipements, 0),
        divers: semPlans.reduce((s:any, p:any) => s + p.charges.divers, 0),
        transport: semPlans[0]?.charges.transport || 0,
        commercialisation: semPlans.reduce((s:any, p:any) => s + p.charges.commercialisation, 0),
      },
      totalCharges: semPlans.reduce((s:any, p:any) => s + p.totalCharges, 0),
      revenuProv: semPlans.reduce((s:any, p:any) => s + p.revenuProv, 0),
      imprevu: semPlans.reduce((s:any, p:any) => s + p.imprevu, 0),
      sousTotalBrut: semPlans.reduce((s:any, p:any) => s + p.sousTotalBrut, 0),
      tva: semPlans.reduce((s:any, p:any) => s + p.tva, 0),
      net: semPlans.reduce((s:any, p:any) => s + p.net, 0),
    };
  }

  const exportPDF = () => {
    const doc = new jsPDF();
    const title = view === "global" ? "Tous les séminaires" : seminars.find((s:any)=>s.id===view)?.title;
    
    // --- Styles ---
    const brandNavy: [number, number, number] = [27, 42, 74];
    const brandGold: [number, number, number] = [201, 168, 76];
    const brandLight: [number, number, number] = [250, 249, 246];

    // --- Header ---
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

    // --- Synthèse Globale ---
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
      headStyles: { fillColor: brandNavy, textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
      bodyStyles: { textColor: brandNavy, fontSize: 11 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right', textColor: brandGold, fontStyle: 'bold' },
        3: { halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: { fillColor: brandLight },
      theme: 'grid'
    });

    // --- Détail des Dépenses ---
    let finalY = (doc as any).lastAutoTable.finalY + 20;

    doc.setTextColor(...brandNavy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("2. Détails des Dépenses", 14, finalY);

    const chargesDiff = (p: number, a: number) => fmt(p - a);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Catégorie de Dépense', 'Budget (Plan)', 'Réel (Dépenses)', 'Écart (Économie/Dépassement)']],
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
      headStyles: { fillColor: brandNavy, textColor: [255,255,255], fontStyle: 'bold' },
      bodyStyles: { textColor: brandNavy, fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' }
      },
      alternateRowStyles: { fillColor: brandLight },
      theme: 'grid',
    });

    // --- Footer Pages ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`RMK CONSEILS - Document Confidentiel - Page ${i} sur ${pageCount}`, 14, 290);
    }

    doc.save(`RMK_Finance_${view}.pdf`);
  };

  const chartData = [
    { name: 'Revenus', Plan: plan.totalRevenus, Réel: actual.totalRevenus },
    { name: 'Charges', Plan: plan.totalCharges, Réel: actual.totalCharges },
    { name: 'Bénéfice Net', Plan: plan.net, Réel: actual.net },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:0 }}>Gestion Financière</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportPDF} style={{ ...btnPrimary, background: "#27AE60", marginRight: 16 }}>📄 Exporter PDF</button>
          <button onClick={() => setView("global")} style={{ ...btnSecondary, background: view === "global" ? `${ORANGE}22` : undefined, color: view === "global" ? ORANGE : "rgba(0,0,0,0.5)" }}>Vue Globale</button>
          {seminars.map((s:any) => (
            <button key={s.id} onClick={() => setView(s.id)} style={{ ...btnSecondary, background: view === s.id ? `${s.color}22` : undefined, color: view === s.id ? s.color : "rgba(0,0,0,0.5)" }}>{s.code}</button>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 24, height: 300 }}>
        <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>Comparatif Plan vs Réel ({view === "global" ? "Tous les séminaires" : seminars.find((s:any)=>s.id===view)?.title})</h3>
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
            {[
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
            ].map((row, i) => {
              const pVal = plan.charges[row.key] || 0;
              const aVal = actual.charges[row.key] || 0;
              const diff = pVal - aVal;
              return (
                <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <td style={{ padding: "10px 16px", color: "#1B2A4A", fontWeight: 500 }}>{row.label}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#2980B9" }}>{fmt(pVal)}</td>
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

      <div style={{ padding:"16px 24px", background: "rgba(39, 174, 96, 0.05)", borderRadius: 12, border: "1px solid rgba(39, 174, 96, 0.2)", marginBottom: 32 }}>
        <div style={{ color:"#27AE60", fontSize:14, fontWeight:800, marginBottom: 12, letterSpacing: 1 }}>RÉSUMÉ DE RENTABILITÉ</div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap: 16 }}>
          <div style={{ color:"#1B2A4A", fontSize:18, fontWeight:800 }}>BÉNÉFICE NET FINAL (TTC)</div>
          <div style={{ color:"#2980B9", fontSize:18, fontWeight:800, textAlign:"right" }}>{fmt(plan.net)}</div>
          <div style={{ color:"#C9A84C", fontSize:18, fontWeight:800, textAlign:"right" }}>{fmt(actual.net)} F</div>
          <div style={{ color: actual.net - plan.net >= 0 ? "#27AE60" : "#E74C3C", fontSize:18, fontWeight:800, textAlign:"right" }}>{fmt(actual.net - plan.net)}</div>
        </div>
      </div>

      <ExpenseManager expenses={expenses} seminars={seminars} refreshExpenses={refreshExpenses} />
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  { value: "consultance_pres", label: "Consultance (Présentiel)" },
  { value: "consultance_ligne", label: "Consultance (En Ligne)" },
  { value: "billet_avion", label: "Billet d'avion" },
  { value: "sejour", label: "Hébergement / Séjour" },
  { value: "salle", label: "Location Salle" },
  { value: "pauses_cafe", label: "Pauses Café" },
  { value: "dejeuner", label: "Déjeuners" },
  { value: "supports", label: "Supports Pédagogiques" },
  { value: "equipements", label: "Équipements" },
  { value: "commercialisation", label: "Communication / Mkt" },
  { value: "transport", label: "Transport local" },
  { value: "divers", label: "Divers & Imprévus" }
];

function ExpenseManager({ expenses, seminars, refreshExpenses }: any) {
  const [form, setForm] = useState({ label:"", amount:0, category:"consultance_pres", seminar:"all", paid:false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label:"", amount:0, category:"", seminar:"", paid:false });
  
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const totalPaid = expenses.filter((e: any) => e.paid).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const totalPending = totalExpenses - totalPaid;

  const upd = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const updEdit = (k: string) => (e: any) => setEditForm({ ...editForm, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const saveExpense = async () => {
    if (!form.label || !form.amount) return;
    await supabase.from('expenses').insert([{ ...form, amount: Number(form.amount) }]);
    refreshExpenses();
    setForm({ label:"", amount:0, category:"consultance_pres", seminar:"all", paid:false });
  };

  const startEdit = (e: any) => {
    setEditingId(e.id);
    setEditForm({ label: e.label, amount: e.amount, category: e.category, seminar: e.seminar, paid: e.paid });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.label || !editForm.amount) return;
    await supabase.from('expenses').update({ ...editForm, amount: Number(editForm.amount) }).eq('id', id);
    setEditingId(null);
    refreshExpenses();
  };

  const togglePaidStatus = async (e: any) => {
    await supabase.from('expenses').update({ paid: !e.paid }).eq('id', e.id);
    refreshExpenses();
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const deleteExpense = async (id: string) => {
    if (window.confirm("⚠️ Supprimer définitivement ?")) {
      await supabase.from('expenses').delete().eq('id', id);
      refreshExpenses();
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color:"#1B2A4A", fontSize:20, fontWeight:800, margin: 0 }}>Gestion des Dépenses</h3>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ background: "rgba(39, 174, 96, 0.1)", color: "#27AE60", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            Payé : {fmt(totalPaid)} F
          </div>
          <div style={{ background: "rgba(243, 156, 18, 0.1)", color: "#E67E22", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            À Payer : {fmt(totalPending)} F
          </div>
        </div>
      </div>
      
      <div style={{ ...card, marginBottom:24 }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto auto", gap:12, alignItems:"end" }}>
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
              {seminars.map((s:any) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </div>
          <div style={{ paddingBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#1B2A4A", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              <input type="checkbox" checked={form.paid} onChange={upd("paid")} /> Payé
            </label>
          </div>
          <button onClick={saveExpense} style={{ ...btnPrimary, height:42 }}>+ Ajouter</button>
        </div>
      </div>

      <div style={{ ...card, padding:0, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1.5fr 1fr 1fr", padding:"12px 16px", background:"#1B2A4A", color:"#fff", fontSize:12, fontWeight:700, textTransform:"uppercase" }}>
          <div>Libellé</div>
          <div>Montant</div>
          <div>Catégorie</div>
          <div>Affectation</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>
        
        {expenses.length === 0 ? (
           <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Aucune dépense enregistrée.</div>
        ) : expenses.map((e: any) => (
          editingId === e.id ? (
            <div key={e.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1.5fr 1fr 1fr", padding:"12px 16px", borderBottom:"1px solid rgba(0,0,0,0.04)", alignItems:"center", gap: 12, background:"rgba(201,168,76,0.05)" }}>
              <input style={{...inputS, padding: "8px 12px"}} value={editForm.label} onChange={updEdit("label")} />
              <input type="number" style={{...inputS, padding: "8px 12px"}} value={editForm.amount} onChange={updEdit("amount")} />
              <select style={{...selectS, padding: "8px 12px"}} value={editForm.category} onChange={updEdit("category")}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select style={{...selectS, padding: "8px 12px"}} value={editForm.seminar} onChange={updEdit("seminar")}>
                <option value="all">Tous (Général)</option>
                {seminars.map((s:any) => <option key={s.id} value={s.id}>{s.code}</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => saveEdit(e.id)} style={{ background:"#27AE60", border:"none", color:"#fff", padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                <button onClick={cancelEdit} style={{ background:"#E74C3C", border:"none", color:"#fff", padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1.5fr 1fr 1fr", padding:"12px 16px", borderBottom:"1px solid rgba(0,0,0,0.04)", alignItems:"center", transition: "background 0.2s" }} onMouseEnter={(ev) => ev.currentTarget.style.background="rgba(0,0,0,0.02)"} onMouseLeave={(ev) => ev.currentTarget.style.background="transparent"}>
              <div style={{ color:"#1B2A4A", fontSize:13, fontWeight:600 }}>{e.label}</div>
              <div style={{ color:"#E74C3C", fontSize:13, fontWeight:700 }}>{fmt(e.amount)} F</div>
              <div style={{ color: '#1B2A4A', fontSize:12, display: "flex", alignItems: "center" }}>
                <span style={{ padding: "4px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 4 }}>
                  {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                </span>
              </div>
              <div style={{ color: '#1B2A4A', fontSize:12, fontWeight: 500 }}>{e.seminar === "all" ? "Général" : seminars.find((s:any)=>s.id===e.seminar)?.code}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                <button onClick={() => togglePaidStatus(e)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }} title={e.paid ? "Marquer comme en attente" : "Marquer comme payé"}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: e.paid ? "#27AE60" : "#E67E22", background: e.paid ? "rgba(39, 174, 96, 0.15)" : "rgba(243, 156, 18, 0.15)", padding: "4px 8px", borderRadius: 100, border: `1px solid ${e.paid ? "rgba(39,174,96,0.3)" : "rgba(243,156,18,0.3)"}` }}>
                    {e.paid ? "✔ Payé" : "⏳ En attente"}
                  </span>
                </button>
                <button onClick={() => startEdit(e)} style={{ background:"none", border:"none", color:"rgba(0,0,0,0.4)", cursor:"pointer", fontSize:14 }} title="Modifier">✏️</button>
                <button onClick={() => deleteExpense(e.id)} style={{ background:"none", border:"none", color:"#E74C3C", cursor:"pointer", fontSize:16 }} title="Supprimer">🗑</button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ─── LEADS MANAGEMENT ───
function LeadsPage({ leads, refreshLeads }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom:"", source:"", status:"froid", notes:"", contact:"" });
  const upd = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const saveLead = async () => {
    if (!form.nom) return;
    if (editingId) {
      await supabase.from('leads').update(form).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('leads').insert([form]);
    }
    refreshLeads();
    setForm({ nom:"", source:"", status:"froid", notes:"", contact:"" });
    setShowForm(false);
  };

  const startEdit = (l: any) => {
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

  const statusColors: any = { froid:"#94A3B8", tiede:"#3498DB", chaud:"#E67E22", signé:"#27AE60" };

  const exportCSV = () => {
    const headers = ["nom", "entreprise", "contact", "source", "status", "notes", "created_at"];
    const csvContent = [
      headers.join(","),
      ...leads.map((l: any) => headers.map(h => `"${(l[h] || "").toString().replace(/"/g, '""')}"`).join(","))
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
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:0 }}>CRM Leads & Prospects</h2>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={exportCSV} style={{ ...btnSecondary, borderColor: "#27AE60", color: "#27AE60" }}>📊 Exporter CSV</button>
          <button onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null); }} style={btnPrimary}>{showForm ? "✕ Fermer" : "+ Nouveau Lead"}</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom:24, borderLeft:`3px solid ${ORANGE}` }}>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>{editingId ? "Modifier le lead" : "Ajouter un lead"}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
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
          <div style={{ marginTop:12 }}>
            <label style={label}>Statut</label>
            <select style={selectS} value={form.status} onChange={upd("status")}>
              <option value="froid">❄️ Froid</option>
              <option value="tiede">🌤 Tiède</option>
              <option value="chaud">🔥 Chaud</option>
              <option value="signé">✅ Signé</option>
            </select>
          </div>
          <div style={{ marginTop:12 }}><label style={label}>Notes CRM</label><textarea style={{ ...inputS, height:80 }} value={form.notes} onChange={upd("notes")} placeholder="Actions..." /></div>
          <button onClick={saveLead} style={{ ...btnPrimary, marginTop:16 }}>✓ Enregistrer</button>
        </div>
      )}

      <div style={{ ...card, padding:0, overflow:"hidden" }}>
        {leads.map((l: any) => (
          <div key={l.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 3fr auto", padding:"14px 16px", borderBottom:"1px solid rgba(0,0,0,0.04)", alignItems:"center" }}>
            <div style={{ fontWeight:700 }}>{l.nom}</div>
            <div style={{ fontSize:12 }}>{l.contact}</div>
            <div><span style={{ ...badge(statusColors[l.status || "froid"]), fontSize:10 }}>{l.status}</span></div>
            <div style={{ fontSize:12, color:"#666" }}>{l.notes}</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => startEdit(l)} style={{ background:"none", border:"none", cursor:"pointer" }}>✏️</button>
              <button onClick={() => deleteLead(l.id)} style={{ background:"none", border:"none", cursor:"pointer" }}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TASKS ───
function TasksPage({ tasks, seminars, refreshTasks }: any) {
  const [newTask, setNewTask] = useState({ task:"", owner:"alexis", deadline:"", seminar:"all", priority:"medium" });
  const addTask = async () => {
    if (!newTask.task) return;
    await supabase.from('tasks').insert([{ ...newTask, status:"todo" }]);
    refreshTasks();
    setNewTask({ task:"", owner:"alexis", deadline:"", seminar:"all", priority:"medium" });
  };
  const cycle = async (id: string, currentStatus: string) => {
    const order = ["todo","progress","done"];
    const nextStatus = order[(order.indexOf(currentStatus)+1) % 3];
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', id);
    refreshTasks();
  };
  const deleteTask = async (id: string) => {
    if (window.confirm("⚠️ Supprimer définitivement ?")) {
      await supabase.from('tasks').delete().eq('id', id);
      refreshTasks();
    }
  };
  const colors: any = { todo:"#94A3B8", progress:"#F39C12", done:"#27AE60" };
  const labels: any = { todo:"À faire", progress:"En cours", done:"Terminé" };
  const pColors: any = { high:"#E74C3C", medium:"#F39C12", low:"#27AE60" };

  return (
    <div>
      <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:"0 0 24px" }}>Gestion des tâches</h2>
      <div style={{ ...card, marginBottom:24 }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
          <div><label style={label}>Tâche *</label><input style={inputS} value={newTask.task} onChange={e => setNewTask({...newTask, task:e.target.value})} placeholder="Description..." /></div>
          <div><label style={label}>Responsable</label>
            <select style={selectS} value={newTask.owner} onChange={e => setNewTask({...newTask, owner:e.target.value})}>
              {TEAM.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><label style={label}>Deadline</label><input type="date" style={inputS} value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline:e.target.value})} /></div>
          <div><label style={label}>Priorité</label>
            <select style={selectS} value={newTask.priority} onChange={e => setNewTask({...newTask, priority:e.target.value})}>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
          </div>
          <div><label style={label}>Séminaire</label>
            <select style={selectS} value={newTask.seminar} onChange={e => setNewTask({...newTask, seminar:e.target.value})}>
              <option value="all">Général</option>
              {seminars.map((s:any) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </div>
          <button onClick={addTask} style={{ ...btnPrimary, height:42 }}>+</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
        {["todo","progress","done"].map(status => (
          <div key={status}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:colors[status] }} />
              <span style={{ color:"#1B2A4A", fontSize:14, fontWeight:700 }}>{labels[status]}</span>
              <span style={{ color: '#1B2A4A', fontSize:12 }}>({tasks.filter((t: any)=>t.status===status).length})</span>
            </div>
            {tasks.filter((t: any) => t.status === status).map((t: any) => (
              <div key={t.id} style={{ ...card, marginBottom:8, borderLeft:`3px solid ${colors[status]}`, padding:16, transition:"all 0.2s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                  <div onClick={() => cycle(t.id, t.status)} style={{ color:"#1B2A4A", fontSize:13, fontWeight:600, flex:1, cursor:"pointer" }}>{t.task}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...badge(pColors[t.priority]), fontSize:9, flexShrink:0 }}>{t.priority}</span>
                    <button onClick={() => deleteTask(t.id)} style={{ background:"none", border:"none", color:"#E74C3C", cursor:"pointer", fontSize:14 }}>🗑</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, marginTop:8, fontSize:11, color: '#1B2A4A' }}>
                  <span>{TEAM.find(m=>m.id===t.owner)?.avatar} {TEAM.find(m=>m.id===t.owner)?.name}</span>
                  {t.deadline && <span>📅 {t.deadline}</span>}
                  {t.seminar !== "all" && <span style={{ color: seminars.find((s:any)=>s.id===t.seminar)?.color }}>{seminars.find((s:any)=>s.id===t.seminar)?.code}</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PRICES ───
function PricesPage({ prices, seminars, setPrices }: any) {
  const upd = (k: string) => (e: any) => {
    const val = Number(e.target.value);
    if (k === 'discountPct') {
      setPrices({ ...prices, discountPct: val, earlyBird: prices.standard * (1 - val / 100) });
    } else if (k === 'standard') {
      setPrices({ ...prices, standard: val, earlyBird: val * (1 - prices.discountPct / 100) });
    } else {
      setPrices({ ...prices, [k]: val });
    }
  };
  return (
    <div>
      <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:"0 0 8px" }}>Gestion des tarifs</h2>
      <p style={{ color: '#1B2A4A', fontSize:14, margin:"0 0 24px" }}>Ajustez les prix en temps réel. Les modifications s'appliquent immédiatement au tableau de bord et aux projections financières.</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <div style={card}>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>Tarifs individuels</h3>
          {[
            { key:"standard", label:"Tarif standard (5 jours hybride)", desc:"Prix plein par personne" },
            { key:"discountPct", label:"Pourcentage de remise Early Bird (%)", desc:"Ex: 10 pour 10%" },
            { key:"earlyBird", label:"Tarif early bird calculé", desc:"Calculé automatiquement", disabled: true },
          ].map(p => (
            <div key={p.key} style={{ marginBottom:16 }}>
              <label style={label}>{p.label}</label>
              <input type="number" style={inputS} value={prices[p.key]} onChange={upd(p.key)} disabled={p.disabled} />
              <div style={{ fontSize:11, color: '#1B2A4A', marginTop:4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <div style={card}>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:16 }}>Rémunération & Budget</h3>
          <div style={{ marginTop:8, padding:16, background:"rgba(201,168,76,0.08)", borderRadius:10, border:`1px solid ${ORANGE}33` }}>
            <div style={{ color:ORANGE, fontSize:13, fontWeight:700 }}>Honoraires CABEXIA (Fixes)</div>
            <div style={{ color: '#1B2A4A', fontSize:12, marginTop:8, lineHeight:1.8 }}>
              Consultance présentiel : <strong style={{ color:"#1B2A4A" }}>1 050 000 FCFA</strong> / séminaire<br/>
              Consultance en ligne : <strong style={{ color:"#1B2A4A" }}>400 000 FCFA</strong> / séminaire<br/>
              Total CABEXIA : <strong style={{ color:"#1B2A4A" }}>1 450 000 FCFA</strong> / séminaire
            </div>
          </div>
          <div style={{ marginTop:16, padding:16, background:"rgba(39,174,96,0.08)", borderRadius:10 }}>
            <div style={{ color:"#27AE60", fontSize:13, fontWeight:700, marginBottom:8 }}>Projection CA (objectif rempli)</div>
            <div style={{ color:"#1B2A4A", fontSize:20, fontWeight:800 }}>{fmt(seminars.reduce((s:any, x:any) => s + x.seats, 0) * prices.standard)} FCFA</div>
            <div style={{ color: '#1B2A4A', fontSize:11, marginTop:4 }}>{seminars.reduce((s:any, x:any) => s + x.seats, 0)} participants × {fmt(prices.standard)} FCFA</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI COMMERCIAL AGENT ───
function AgentPage({ seminars }: any) {
  const [seminar, setSeminar] = useState(seminars[0]?.id || "s1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [history, setHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('rmk_agent_history') || '[]'); } catch { return []; }
  });

  const runAgent = async () => {
    const s = seminars.find((x:any) => x.id === seminar);
    if (!s) return;
    setLoading(true);
    setResult("");
    const systemPrompt = `Tu es un agent commercial expert pour RMK Conseils, société qui organise des séminaires de formation en Intelligence Artificielle à Abidjan, Côte d'Ivoire. La formation est délivrée par CABEXIA, Cabinet d'Expertise en IA.

Voici la stratégie commerciale globale de l'événement :
${COMMERCIAL_STRATEGY}

Tu dois identifier les MEILLEURS profils de participants potentiels pour le séminaire "${s.title}" (${s.week}).

Contexte marché Abidjan:
- 1ère place financière UEMOA (BRVM, BCEAO)
- 28 banques commerciales, nombreuses SGI et assurances
- 500+ grandes entreprises et multinationales
- Écosystème tech en croissance +15% annuel
- Mobile money: Orange Money, MTN MoMo, Wave

Profils cibles: ${s.targets.join(", ")}
Secteurs prioritaires: ${s.sectors.join(", ")}
Prix: 600 000 FCFA (5 jours hybride: 3 présentiel + 2 en ligne)
Places: ${s.seats} maximum

Réponds en français. Fournis un plan de prospection journalier avec:
1. TOP 10 entreprises/institutions à contacter en priorité à Abidjan (noms réels)
2. Les profils décideurs clés dans chaque entreprise (titres de poste)
3. Argumentaire de vente adapté au secteur
4. Script d'approche LinkedIn (message InMail)
5. Script WhatsApp de premier contact
6. Objections probables et réponses
7. Canaux de contact recommandés par cible`;

    const userPrompt = `Génère le plan de prospection du jour pour le séminaire ${s.code} - ${s.title}. Concentre-toi sur les entreprises les plus susceptibles d'inscrire leurs cadres. Sois concret avec des noms d'entreprises réelles d'Abidjan et de Côte d'Ivoire.`;

    const tools = [{
      name: "check_seminar_stats",
      description: "Récupère les statistiques réelles d'inscription pour un séminaire donné (nombre d'inscrits, confirmés, places restantes)",
      parameters: {
        type: "object",
        properties: {
          seminarCode: { type: "string", description: "Le code du séminaire: S1, S2, S3 ou S4" }
        },
        required: ["seminarCode"]
      }
    }];

    const res = await callGemini(systemPrompt, userPrompt, seminars, true, tools);
    setResult(res.text);
    const newHistory = [{ date: new Date().toLocaleString("fr-FR"), seminar: s.code, title: s.title, result: res.text }, ...history.slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('rmk_agent_history', JSON.stringify(newHistory));
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:"0 0 8px" }}>Agent Commercial IA</h2>
      <p style={{ color: '#1B2A4A', fontSize:14, margin:"0 0 24px" }}>Prospection automatisée : identification des meilleurs profils d'apprenants, scripts de vente et plans de contact personnalisés par séminaire.</p>

      <div style={{ ...card, marginBottom:24, display:"flex", gap:12, alignItems:"end", flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:200 }}>
          <label style={label}>Séminaire cible</label>
          <select style={selectS} value={seminar} onChange={e => setSeminar(e.target.value)}>
            {seminars.map((s:any) => <option key={s.id} value={s.id}>{s.icon} {s.code} – {s.title}</option>)}
          </select>
        </div>
        <button onClick={runAgent} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, minWidth:220 }}>
          {loading ? "🔄 Analyse en cours..." : "🤖 Lancer la prospection du jour"}
        </button>
      </div>

      {result && (
        <div style={{ ...card, marginBottom:24, borderLeft:`3px solid ${ORANGE}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, margin:0 }}>📋 Plan de prospection – {seminars.find((x:any)=>x.id===seminar)?.code}</h3>
            <span style={{ fontSize:11, color: '#1B2A4A' }}>{new Date().toLocaleString("fr-FR")}</span>
          </div>
          <div style={{ color: '#1B2A4A', fontSize:14, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{result}</div>
        </div>
      )}

      {history.length > 0 && (
        <>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:12 }}>Historique des recherches</h3>
          {history.map((h, i) => (
            <details key={i} style={{ ...card, marginBottom:8, cursor:"pointer" }}>
              <summary style={{ color:"#1B2A4A", fontSize:13, fontWeight:600 }}>{h.date} – {h.seminar} {h.title}</summary>
              <div style={{ color: '#1B2A4A', fontSize:13, lineHeight:1.7, marginTop:12, whiteSpace:"pre-wrap" }}>{h.result}</div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}

// ─── RESEARCH AGENT ───
function ResearchPage({ seminars }: { seminars: Seminar[] }) {
  const [query, setQuery] = useState("prix billet avion Paris Abidjan mai 2026");
  const [category, setCategory] = useState("avion");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [history, setHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('rmk_research_history') || '[]'); } catch { return []; }
  });

  const presets = [
    { cat:"avion", label:"✈️ Vol Paris → Abidjan", query:"prix billet avion aller-retour Paris Abidjan mai 2026 compagnies aériennes" },
    { cat:"avion", label:"✈️ Vol Ndjamena → Abidjan", query:"prix billet avion aller-retour Ndjamena Abidjan mai 2026" },
    { cat:"salle", label:"🏢 Salle de conférence Abidjan", query:"prix location salle de conférence séminaire 20-25 personnes Abidjan Plateau Cocody 2026" },
    { cat:"traiteur", label:"🍽️ Traiteur Abidjan", query:"prix traiteur pause café déjeuner séminaire professionnel 20 personnes Abidjan" },
    { cat:"hotel", label:"🏨 Hôtel formateur", query:"prix hôtel business Abidjan Plateau Cocody 4 nuits mai 2026" },
    { cat:"zoom", label:"💻 Zoom Pro", query:"prix abonnement Zoom Pro mensuel fonctionnalités webinaire 2026" },
  ];

  const runResearch = async (q = query) => {
    setLoading(true);
    setResult("");
    const systemPrompt = `Tu es un assistant de recherche pour RMK, société qui organise des séminaires de formation IA à Abidjan en mai 2026. Tu dois fournir des estimations de prix détaillées et réalistes basées sur le marché ivoirien/ouest-africain.

Pour chaque recherche, fournis:
1. FOURCHETTE DE PRIX en FCFA (minimum – moyen – maximum)
2. Les prestataires recommandés avec noms et contacts si possible
3. Conseils de négociation
4. Alternatives économiques
5. Timing de réservation optimal
6. Conditions et inclusions typiques

Sois très concret et adapté au contexte d'Abidjan, Côte d'Ivoire. Utilise les prix réels du marché local. Monnaie: FCFA (XOF).`;

    const res = await callGemini(systemPrompt, q, seminars, true);
    setResult(res.text);
    const newHistory = [{ date: new Date().toLocaleString("fr-FR"), query: q, result: res.text }, ...history.slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('rmk_research_history', JSON.stringify(newHistory));
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ color:"#1B2A4A", fontSize:24, fontWeight:800, margin:"0 0 8px" }}>Agent Recherche & Estimations</h2>
      <p style={{ color: '#1B2A4A', fontSize:14, margin:"0 0 24px" }}>Recherche de prix en temps réel : billets d'avion, salles, traiteurs, hôtels et tout ce dont vous avez besoin pour le budget.</p>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {presets.map((p, i) => (
          <button key={i} onClick={() => { setQuery(p.query); setCategory(p.cat); runResearch(p.query); }}
            style={{ ...btnSecondary, fontSize:12 }}>{p.label}</button>
        ))}
      </div>

      <div style={{ ...card, marginBottom:24, display:"flex", gap:12, alignItems:"end", flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:300 }}>
          <label style={label}>Recherche personnalisée</label>
          <input style={inputS} value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex: prix location salle 25 personnes Abidjan..." onKeyDown={e => e.key === "Enter" && runResearch()} />
        </div>
        <button onClick={() => runResearch()} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, minWidth:200 }}>
          {loading ? "🔄 Recherche..." : "🔍 Rechercher & Estimer"}
        </button>
      </div>

      {result && (
        <div style={{ ...card, marginBottom:24, borderLeft:"3px solid #2980B9" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, margin:0 }}>📊 Résultats de recherche</h3>
            <span style={{ fontSize:11, color: '#1B2A4A' }}>{new Date().toLocaleString("fr-FR")}</span>
          </div>
          <div style={{ color: '#1B2A4A', fontSize:14, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{result}</div>
        </div>
      )}

      {history.length > 0 && (
        <>
          <h3 style={{ color:"#1B2A4A", fontSize:16, fontWeight:700, marginBottom:12 }}>Historique des recherches</h3>
          {history.map((h, i) => (
            <details key={i} style={{ ...card, marginBottom:8, cursor:"pointer" }}>
              <summary style={{ color:"#1B2A4A", fontSize:13, fontWeight:600 }}>{h.date} – {h.query.slice(0, 60)}...</summary>
              <div style={{ color: '#1B2A4A', fontSize:13, lineHeight:1.7, marginTop:12, whiteSpace:"pre-wrap" }}>{h.result}</div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ───
export default function AdminDashboard() {
  const [page, setPage] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSeminars = async () => {
    const { data } = await supabase.from('seminars').select('*').order('code', { ascending: true });
    if (data && data.length > 0) {
      setSeminars(data);
    } else {
      setSeminars(DEFAULT_SEMINARS);
    }
  };

  const fetchParticipants = async () => {
    const { data } = await supabase.from('participants').select('*').order('created_at', { ascending: false });
    if (data) setParticipants(data);
  };
  const fetchExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (data) setExpenses(data);
  };
  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data);
  };
  const fetchLeads = async () => {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      try {
        console.log("AdminDashboard: Starting data initialization...");
        await Promise.all([
          fetchSeminars().catch(e => console.error("Error fetching seminars:", e)),
          fetchParticipants().catch(e => console.error("Error fetching participants:", e)),
          fetchExpenses().catch(e => console.error("Error fetching expenses:", e)),
          fetchTasks().catch(e => console.error("Error fetching tasks:", e)),
          fetchLeads().catch(e => console.error("Error fetching leads:", e))
        ]);
        console.log("AdminDashboard: Data initialization complete.");
      } catch (error) {
        console.error("AdminDashboard: Critical initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
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
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
    if (supabaseUrl === 'https://placeholder.supabase.co') {
      alert("Supabase n'est pas configuré. Connexion simulée.");
      setUser({ email: "admin@rmkconsulting.pro", user_metadata: { name: "Admin RMK" } });
      return;
    }
    
    if (!email || !password) {
      setLoginError("Veuillez remplir tous les champs.");
      return;
    }
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Login error", error);
      setLoginError(error.message || "Erreur d'authentification.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY }}>
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
            
            <button type="submit" style={{ ...btnPrimary, width: "100%", marginTop: 8 }}>
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:NAVY, minHeight:"100vh", color:"#1B2A4A" }}>
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
      <main style={{ marginLeft:220, padding:"24px 32px", minHeight:"100vh" }}>
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
              {[1,2,3,4].map(i => (
                <div key={i} style={{ ...card, height: 100, background: "rgba(0,0,0,0.04)", animation: `skeleton-pulse 1.5s ease-in-out infinite ${i * 0.15}s` }} />
              ))}
            </div>
            <div style={{ ...card, height: 300, background: "rgba(0,0,0,0.04)", animation: "skeleton-pulse 1.5s ease-in-out infinite 0.6s", marginBottom: 24 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ ...card, height: 200, background: "rgba(0,0,0,0.04)", animation: "skeleton-pulse 1.5s ease-in-out infinite 0.8s" }} />
              <div style={{ ...card, height: 200, background: "rgba(0,0,0,0.04)", animation: "skeleton-pulse 1.5s ease-in-out infinite 1s" }} />
            </div>
          </div>
        ) : (
          <>
            {page === "dashboard" && <DashboardPage participants={participants} prices={prices} tasks={tasks} leads={leads} seminars={seminars} />}
            {page === "seminaires" && <SeminarsManagement seminars={seminars} refreshSeminars={fetchSeminars} />}
            {page === "inscriptions" && <InscriptionsPage participants={participants} seminars={seminars} refreshParticipants={fetchParticipants} />}
            {page === "leads" && <LeadsPage leads={leads} refreshLeads={fetchLeads} />}
            {page === "finance" && <FinancePage participants={participants} seminars={seminars} prices={prices} expenses={expenses} refreshExpenses={fetchExpenses} />}
            {page === "tasks" && <TasksPage tasks={tasks} seminars={seminars} refreshTasks={fetchTasks} />}
            {page === "prices" && <PricesPage prices={prices} setPrices={setPrices} seminars={seminars} />}
            {page === "agent" && <AgentPage seminars={seminars} />}
            {page === "seo" && <SeoAgentPage seminars={seminars} />}
            {page === "flyer" && <FlyerPage seminars={seminars} />}
            {page === "research" && <ResearchPage seminars={seminars} />}
          </>
        )}
      </main>
    </div>
  );
}
