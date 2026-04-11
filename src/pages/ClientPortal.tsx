import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

const DEFAULT_SEMINARS = [
  { id:"s1", code:"S1", title:"IA Stratégique pour Dirigeants", week:"5–9 Mai 2026", icon: "🎯" },
  { id:"s2", code:"S2", title:"IA appliquée à la Finance", week:"12–16 Mai 2026", icon: "💰" },
  { id:"s3", code:"S3", title:"IA pour les Notaires", week:"19–23 Mai 2026", icon: "⚖️" },
  { id:"s4", code:"S4", title:"IA pour les Ressources Humaines", week:"26–30 Mai 2026", icon: "👥" },
];

const SYLLABUS = [
  { day: "Jour 1", mode: "Présentiel", location: "Abidjan", title: "Fondamentaux & Stratégie IA", desc: "Démystification de l'IA générative. Audit de maturité digitale de votre organisation. Cartographie des cas d'usage à fort ROI pour votre secteur.", color: "#C9A84C" },
  { day: "Jour 2", mode: "Présentiel", location: "Abidjan", title: "Ingénierie de Prompts & Outils Avancés", desc: "Maîtrise complète de ChatGPT, Claude et Gemini. Techniques avancées pour automatiser l'analyse de données, la rédaction et la prise de décision.", color: "#C9A84C" },
  { day: "Jour 3", mode: "Présentiel", location: "Abidjan", title: "Atelier Pratique : Construire vos Solutions", desc: "Déploiement sur vos propres données professionnelles. Création de workflows intelligents et d'assistants IA sur-mesure pour votre entreprise.", color: "#C9A84C" },
  { day: "Jour 4", mode: "Distanciel", location: "En ligne", title: "Accompagnement & Implémentation", desc: "Suivi à distance de la mise en œuvre. Sessions individuelles de coaching. Résolution de problèmes spécifiques à votre contexte professionnel.", color: "#27AE60" },
  { day: "Jour 5", mode: "Distanciel", location: "En ligne", title: "Évaluation & Certification", desc: "Validation des acquis et des cas d'usage en situation réelle. Présentation des projets finaux. Remise des attestations officielles par RMK CONSEILS.", color: "#27AE60" },
];

import { LogoRMK } from "../components/LogoRMK";
import { useEffect } from 'react';

export default function ClientPortal() {
  const [email, setEmail] = useState('');
  const [participant, setParticipant] = useState<any>(null);
  const [seminars, setSeminars] = useState<any[]>(DEFAULT_SEMINARS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSeminars = async () => {
      const { data, error } = await supabase.from('seminars').select('*');
      if (!error && data && data.length > 0) {
        setSeminars(data);
      }
    };
    fetchSeminars();
  }, []);
  const [activeTab, setActiveTab] = useState<'overview' | 'syllabus' | 'payment' | 'documents'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const searchParticipant = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    setParticipant(null);
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .limit(1)
        .maybeSingle();
      
      if (error || !data) {
        setError('Aucune inscription trouvée pour cet email.');
      } else {
        setParticipant(data);
      }
    } catch (err) {
      setError('Erreur lors de la recherche.');
    }
    setLoading(false);
  };

  const exportAttestation = () => {
    if (!participant || participant.status !== 'confirmed') return;
    const s = seminars.find(x => x.id === participant.seminar);
    if (!s) return;

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
    doc.text(`${participant.prenom} ${participant.nom}`.toUpperCase(), 148.5, 100, { align: "center" });
    
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
    doc.text("L'Expert Formateur Consultant", 247, 180, { align: "center" });
    
    doc.save(`Attestation_${participant.nom}_${s.code}.pdf`);
  };

  const seminar = participant ? seminars.find(s => s.id === participant.seminar) : null;

  // ─── LOGIN SCREEN ───
  if (!participant) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF9F6', color: '#1B2A4A', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 460, width: '100%', background: '#FFFFFF', padding: '48px 40px', borderRadius: 24, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: 40, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <LogoRMK scale={1.2} variant="light" />
            <div style={{ color: '#C9A84C', fontSize: 13, fontWeight: 800, letterSpacing: 5, textTransform: 'uppercase', marginTop: 20 }}>Espace Client Privé</div>
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, textAlign: 'center', color: '#1B2A4A' }}>Accès Formation</h2>
          <p style={{ color: 'rgba(27,42,74,0.7)', fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 1.6 }}>Identifiez-vous pour accéder à votre programme et vos documents.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="votre.email@entreprise.com" 
                style={{ width: '100%', padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.03)', color: '#1B2A4A', fontSize: 16, outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#C9A84C'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(0,0,0,0.1)'}
                onKeyDown={e => e.key === 'Enter' && searchParticipant()}
              />
            </div>
            <button 
              onClick={searchParticipant} 
              disabled={loading}
              style={{ width: '100%', padding: '16px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #C9A84C, #A88A3D)', color: '#FFFFFF', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.3s' }}
            >
              {loading ? 'Vérification...' : 'Se connecter'}
            </button>
          </div>

          {error && <div style={{ color: '#E74C3C', fontSize: 14, marginTop: 20, textAlign: 'center', background: 'rgba(231,76,60,0.05)', padding: 14, borderRadius: 10, border: '1px solid rgba(231,76,60,0.1)' }}>{error}</div>}

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(27,42,74,0.4)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '0 auto' }}>
              <span>←</span> Retour au site principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD SCREEN (after login) ───
  const sidebarItems = [
    { key: 'overview' as const, label: 'Tableau de bord', icon: '💎' },
    { key: 'syllabus' as const, label: 'Programme', icon: '📅' },
    { key: 'payment' as const, label: 'Paiement', icon: '💳' },
    { key: 'community' as const, label: 'Communauté', icon: '🤝', locked: participant.status !== 'confirmed' },
    { key: 'documents' as const, label: 'Documents', icon: '📄' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6', color: '#1B2A4A', fontFamily: "'DM Sans', sans-serif", display: 'flex' }}>
      {/* ─── SIDEBAR (Desktop) ─── */}
      <aside style={{
        width: 260, background: '#1B2A4A', borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', padding: '32px 0', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }} className="portal-sidebar">
        <div style={{ padding: '0 24px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogoRMK scale={0.45} variant="dark" />
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#FAF9F6', letterSpacing: 1 }}>RMK CONSEILS</div>
            <div style={{ fontSize: 10, color: '#C9A84C', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Espace Privé</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => !item.locked && setActiveTab(item.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px',
                background: activeTab === item.key ? 'rgba(201,168,76,0.15)' : 'transparent',
                border: 'none', borderLeft: activeTab === item.key ? '4px solid #C9A84C' : '4px solid transparent',
                color: activeTab === item.key ? '#C9A84C' : 'rgba(250,249,246,0.6)',
                fontSize: 14, fontWeight: activeTab === item.key ? 700 : 500, cursor: item.locked ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all 0.3s',
                opacity: item.locked ? 0.4 : 1,
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
              {item.locked && <span style={{ fontSize: 10, marginLeft: 'auto' }}>🔒</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding: '0 24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #A88A3D)', color: '#1B2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
              {participant.prenom[0]}{participant.nom[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#FAF9F6', fontWeight: 600 }}>{participant.prenom} {participant.nom}</div>
              <div style={{ fontSize: 11, color: 'rgba(250,249,246,0.5)' }}>Client Privé</div>
            </div>
          </div>
          <button onClick={() => { setParticipant(null); setEmail(''); setActiveTab('overview'); }}
            style={{ width: '100%', marginTop: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FF7675', fontSize: 13, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, transition: 'all 0.2s' }}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── MOBILE TOP BAR ─── */}
      <div className="portal-mobile-bar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: '#1B2A4A',
        borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoRMK scale={0.35} variant="dark" forceText={true} />
          <span style={{ color: '#FAF9F6', fontWeight: 700, fontSize: 14 }}>Mon Espace</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', color: '#FAF9F6', fontSize: 22, cursor: 'pointer' }}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* ─── MOBILE DROPDOWN MENU ─── */}
      {mobileMenuOpen && (
        <div className="portal-mobile-dropdown" style={{
          display: 'none', position: 'fixed', top: 52, left: 0, right: 0, zIndex: 199,
          background: '#1B2A4A', borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '8px 0',
        }}>
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => !item.locked && (setActiveTab(item.key), setMobileMenuOpen(false))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                background: activeTab === item.key ? 'rgba(201,168,76,0.1)' : 'transparent',
                border: 'none', color: activeTab === item.key ? '#C9A84C' : 'rgba(250,249,246,0.6)',
                fontSize: 15, fontWeight: activeTab === item.key ? 700 : 500, cursor: item.locked ? 'not-allowed' : 'pointer', textAlign: 'left',
                opacity: item.locked ? 0.4 : 1,
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
              {item.locked && <span style={{ fontSize: 12, marginLeft: 'auto' }}>🔒</span>}
            </button>
          ))}
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main className="portal-main" style={{ flex: 1, marginLeft: 260, padding: '40px 48px', minHeight: '100vh', overflowY: 'auto' }}>

              {/* NOTIFICATION BAREER (DATE CHANGES) */}
        <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>📅</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#E74C3C' }}>ALERTE DE CALENDRIER</div>
            <div style={{ fontSize: 13, color: '#1B2A4A' }}>Attention : Veuillez vérifier les dates de vos sessions dans l'onglet 'Programme' suite à de récentes mises à jour.</div>
          </div>
        </div>

        {/* ─── TAB: OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ marginBottom: 40 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: '#1B2A4A' }}>
                Heureux de vous revoir, <span style={{ color: '#C9A84C' }}>{participant.prenom}</span>
              </h1>
              <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 16 }}>Accédez à votre espace de formation RMK Conseils.</p>
            </div>

            {/* Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 40 }}>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '32px 24px' }}>
                <div style={{ fontSize: 12, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>Votre Session</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1B2A4A', lineHeight: 1.3 }}>{seminar?.icon} {seminar?.title}</div>
                <div style={{ fontSize: 14, color: 'rgba(27,42,74,0.5)', marginTop: 8 }}>📅 {seminar?.week}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '32px 24px' }}>
                <div style={{ fontSize: 12, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>État de l'inscription</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: participant.status === 'confirmed' ? 'rgba(39,174,96,0.1)' : 'rgba(243,156,18,0.1)',
                  color: participant.status === 'confirmed' ? '#27AE60' : '#F39C12',
                  border: `1px solid ${participant.status === 'confirmed' ? 'rgba(39,174,96,0.2)' : 'rgba(243,156,18,0.2)'}`
                }}>
                  {participant.status === 'confirmed' ? '✅ INSCRIPTION VALIDÉE' : '⏳ ATTENTE PAIEMENT'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(27,42,74,0.5)', marginTop: 12 }}>
                  {participant.status === 'confirmed' ? 'Tout est prêt pour votre accueil.' : 'Place réservée (temporaire).'}
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '32px 24px' }}>
                <div style={{ fontSize: 12, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>Investissement</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1B2A4A' }}>{Number(participant.amount || 540000).toLocaleString('fr-FR')} <span style={{ fontSize: 16, color: 'rgba(27,42,74,0.4)' }}>FCFA</span></div>
                <div style={{ fontSize: 13, color: 'rgba(27,42,74,0.5)', marginTop: 10 }}>Paiement via Wave/Orange/Virement</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <button onClick={() => setActiveTab('syllabus')} style={{
                padding: '24px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.04)',
                color: '#1B2A4A', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s',
              }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🗓️</div>
                Consulter le Programme
                <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.5)', marginTop: 8, fontWeight: 400 }}>Détail des 5 jours de formation</div>
              </button>
              <button onClick={() => setActiveTab('payment')} style={{
                padding: '24px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.1)',
                color: '#A88A3D', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s',
              }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>💳</div>
                Finaliser mon Paiement
                <div style={{ fontSize: 12, color: 'rgba(201,168,76,0.6)', marginTop: 8, fontWeight: 400 }}>Wave, Orange Money, Virement</div>
              </button>
              <button onClick={() => participant.status === 'confirmed' ? setActiveTab('community') : setActiveTab('payment')} style={{
                padding: '24px', borderRadius: 20, border: '1px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.05)',
                color: '#2563EB', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s',
                opacity: participant.status === 'confirmed' ? 1 : 0.6
              }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🤝</div>
                Espace Communauté
                <div style={{ fontSize: 12, color: 'rgba(37,99,235,0.5)', marginTop: 8, fontWeight: 400 }}>Networking & Entraide</div>
              </button>
              <button onClick={() => setActiveTab('documents')} style={{
                padding: '24px', borderRadius: 20, border: '1px solid rgba(39,174,96,0.2)', background: 'rgba(39,174,96,0.05)',
                color: '#27AE60', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s',
              }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>📄</div>
                Mes Documents
                <div style={{ fontSize: 12, color: 'rgba(39,174,96,0.5)', marginTop: 8, fontWeight: 400 }}>Attestation & Invitations</div>
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: SYLLABUS ─── */}
        {activeTab === 'syllabus' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: '#1B2A4A' }}>📅 Programme du Séminaire</h1>
            <p style={{ color: '#C9A84C', fontSize: 16, marginBottom: 40, fontWeight: 600 }}>
              {seminar?.icon} {seminar?.title} — {seminar?.week}
            </p>

            <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 24, padding: 32, marginBottom: 32 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#A88A3D', marginTop: 0, marginBottom: 16 }}>🎯 Objectifs du programme</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(27,42,74,0.7)', fontSize: 15, lineHeight: 2 }}>
                <li>Comprendre les transformations économiques provoquées par l'IA</li>
                <li>Développer la capacité à utiliser l'IA comme outil d'aide à la décision</li>
                <li>Maîtriser les techniques de prompting pour des résultats fiables</li>
                <li>Identifier les opportunités d'intégration de l'IA</li>
                <li>Renforcer la capacité stratégique face aux technologies</li>
              </ul>
            </div>

            {/* Axes content ... keeping original logic but updating styles */}
            {(() => {
              const isUnlocked = participant.status === 'confirmed';
              const axes = [
                { title: "IA et transformation du leadership", icon: "🏛️", color: "#C9A84C", points: ["Comprendre les transformations économiques liées à l'IA", "Le rôle du dirigeant dans l'économie algorithmique", "Les opportunités et limites de l'IA générative", "L'IA comme levier de transformation"] },
                { title: "Prompt engineering stratégique", icon: "⚡", color: "#C9A84C", points: ["Structure d'un prompt professionnel efficace", "Techniques avancées pour dialoguer avec l'IA", "Construction de prompts pour l'analyse stratégique"] },
                { title: "IA et décision augmentée", icon: "📊", color: "#2563EB", points: ["Analyse stratégique assistée par l'IA", "Simulation de scénarios de décision", "Analyse de données et synthèses exécutives"] },
                { title: "Gouvernance et responsabilité", icon: "🛡️", color: "#27AE60", points: ["Confidentialité et protection des données", "Risques liés aux biais algorithmiques", "Responsabilité managériale"] },
              ];

              return (
                <div style={{ display: 'grid', gap: 20, marginBottom: 40 }}>
                  {axes.map((axe, i) => (
                    <div key={i} style={{
                      background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: 18, padding: 24, borderLeft: `4px solid ${axe.color}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isUnlocked ? 16 : 0 }}>
                        <span style={{ fontSize: 24 }}>{axe.icon}</span>
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1B2A4A', margin: 0 }}>Axe {i + 1} — {axe.title}</h3>
                      </div>
                      {isUnlocked ? (
                        <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(27,42,74,0.6)', fontSize: 14, lineHeight: 1.8 }}>
                          {axe.points.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      ) : (
                        <div style={{ marginTop: 8, color: 'rgba(27,42,74,0.3)', fontSize: 13, fontStyle: 'italic' }}>
                          Contenu détaillé réservé aux participants confirmés 🔒
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── TAB: PAYMENT ─── */}
        {activeTab === 'payment' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: '#1B2A4A' }}>💳 Règlement</h1>
            <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 16, marginBottom: 40 }}>Finalisez votre inscription sécurisée.</p>

            <div style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.05))', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 24, padding: 40, textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 13, color: '#A88A3D', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 12 }}>Montant Net à Régler</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#1B2A4A' }}>{Number(participant.amount || 540000).toLocaleString('fr-FR')} <span style={{ fontSize: 20, color: 'rgba(27,42,74,0.3)' }}>FCFA</span></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: 28 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#C9A84C', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>📱 Mobile Money</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: '16px', background: 'rgba(0,0,0,0.03)', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.4)', marginBottom: 4 }}>WAVE / ORANGE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1B2A4A' }}>+225 07 02 61 15 82</div>
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(27,42,74,0.5)', lineHeight: 1.5 }}>Envoyez votre reçu via WhatsApp au même numéro (+225 07 02 61 15 82) pour une validation rapide.</p>
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: 28 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#C9A84C', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>🏦 Virement Bancaire</div>
                <p style={{ fontSize: 14, color: 'rgba(27,42,74,0.7)', lineHeight: 1.6 }}>Contactez-nous pour recevoir le RIB de **RMK Conseils** et une facture proforma définitive.</p>
                <button style={{ marginTop: 12, padding: '12px 20px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', color: '#1B2A4A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Demander un RIB</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: COMMUNITY ─── */}
        {activeTab === 'community' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: '#1B2A4A' }}>🤝 Communauté RMK</h1>
            <p style={{ color: '#C9A84C', fontSize: 16, marginBottom: 40, fontWeight: 600 }}>Espace exclusif de networking pour la cohorte Mai 2026.</p>

            <div style={{ background: '#1B2A4A', border: '1px solid #C9A84C', borderRadius: 24, padding: 48, textAlign: 'center', marginBottom: 40, boxShadow: '0 20px 40px rgba(27,42,74,0.15)' }}>
              <div style={{ fontSize: 56, marginBottom: 24 }}>🚀</div>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: '#FAF9F6', marginBottom: 16 }}>Bienvenue dans l'Élite de l'IA</h2>
              <p style={{ fontSize: 17, color: 'rgba(250,249,246,0.7)', maxWidth: 650, margin: '0 auto 36px', lineHeight: 1.8 }}>
                Félicitations, <strong style={{ color: '#C9A84C' }}>{participant.prenom}</strong> ! Vous faites maintenant partie d'un réseau exclusif de dirigeants ivoiriens tournés vers l'avenir. 
                Échangez, partagez vos défis et collaborez avant même la session présentielle.
              </p>
              <button onClick={() => window.open('https://chat.whatsapp.com/ExempleLink', '_blank')} 
                style={{ padding: '20px 40px', borderRadius: 14, background: '#25D366', color: '#FFFFFF', border: 'none', fontSize: 17, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(37,211,102,0.3)', transition: 'all 0.3s' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Rejoindre le groupe WhatsApp RMK
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: 28 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A', marginBottom: 16 }}>👥 Vos Pairs (Cohorte)</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    { name: "Jean-Baptiste K.", role: "DG, Banque d'Affaires", avatar: "👤" },
                    { name: "Mariam T.", role: "Dir. Marketing, Telecom", avatar: "👩‍💼" },
                    { name: "Assane O.", role: "Fondateur, Tech Start-up", avatar: "👨‍💻" }
                  ].map((pair, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>{pair.avatar}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1B2A4A' }}>{pair.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(27,42,74,0.5)' }}>{pair.role}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ color: 'rgba(27,42,74,0.3)', fontSize: 12, fontStyle: 'italic', marginTop: 8 }}>
                    + 12 autres dirigeants inscrits...
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: 28 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A', marginBottom: 16 }}>📖 Ressources Partagées</h3>
                <div style={{ display: 'grid', gap: 16 }}>
                  {[
                    { title: "Étude : L'impact de l'IA sur le CAC 40", type: "PDF", color: "#E74C3C" },
                    { title: "Dashboard Stratégique (Template)", type: "XLSX", color: "#27AE60" }
                  ].map((res, idx) => (
                    <div key={idx} style={{ padding: '12px 16px', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 14, color: 'rgba(27,42,74,0.8)' }}>{res.title}</div>
                      <span style={{ fontSize: 10, background: res.color, color: "#FFF", padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>{res.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: DOCUMENTS ─── */}
        {activeTab === 'documents' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: '#1B2A4A' }}>📄 Centre de Documents</h1>
            <p style={{ color: 'rgba(27,42,74,0.6)', fontSize: 16, marginBottom: 40 }}>Téléchargez vos pièces justificatives et attestations.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 24, padding: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 20 }}>🎓</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A', marginBottom: 12 }}>Attestation Officielle</h3>
                <p style={{ fontSize: 14, color: 'rgba(27,42,74,0.6)', lineHeight: 1.6, marginBottom: 24 }}>Document certifiant votre réussite au programme IA Stratégique.</p>
                {participant.status === 'confirmed' ? (
                  <button onClick={exportAttestation} style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#27AE60', color: '#FFF', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Télécharger PDF</button>
                ) : (
                  <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(0,0,0,0.05)', color: 'rgba(27,42,74,0.4)', textAlign: 'center', fontSize: 13 }}>🔒 Après validation du paiement</div>
                )}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 24, padding: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 20 }}>🧾</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A', marginBottom: 12 }}>Facture / Quittance</h3>
                <p style={{ fontSize: 14, color: 'rgba(27,42,74,0.6)', lineHeight: 1.6, marginBottom: 24 }}>Justificatif de paiement pour votre comptabilité entreprise.</p>
                <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(0,0,0,0.05)', color: 'rgba(27,42,74,0.4)', textAlign: 'center', fontSize: 13 }}>Généré automatiquement sous 48h</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── RESPONSIVE CSS ─── */}
      <style>{`
        @media (max-width: 768px) {
          .portal-sidebar { display: none !important; }
          .portal-mobile-bar { display: flex !important; }
          .portal-mobile-dropdown { display: block !important; }
          .portal-main { margin-left: 0 !important; padding: 72px 16px 24px !important; }
        }
      `}</style>
    </div>
  );
}
