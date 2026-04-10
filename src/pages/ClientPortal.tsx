import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

const SEMINARS = [
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
  { day: "Jour 5", mode: "Distanciel", location: "En ligne", title: "Évaluation & Certification", desc: "Validation des acquis et des cas d'usage en situation réelle. Présentation des projets finaux. Remise des attestations officielles CABEXIA.", color: "#27AE60" },
];

import { LogoRMK } from "../components/LogoRMK";

export default function ClientPortal() {
  const [email, setEmail] = useState('');
  const [participant, setParticipant] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    const s = SEMINARS.find(x => x.id === participant.seminar);
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
    doc.text("L'Expert Formateur, CABEXIA", 247, 180, { align: "center" });
    
    doc.save(`Attestation_${participant.nom}_${s.code}.pdf`);
  };

  const seminar = participant ? SEMINARS.find(s => s.id === participant.seminar) : null;

  // ─── LOGIN SCREEN ───
  if (!participant) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', color: '#fff', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 460, width: '100%', background: 'rgba(255,255,255,0.05)', padding: '48px 40px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <LogoRMK scale={0.8} />
            <div style={{ color: '#C9A84C', fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', marginTop: 12 }}>Portail Client</div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Mon Espace Formation</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>Entrez l'adresse email utilisée lors de votre inscription pour accéder à vos documents.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="votre.email@entreprise.com" 
              style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, outline: 'none', transition: 'border 0.2s' }}
              onKeyDown={e => e.key === 'Enter' && searchParticipant()}
            />
            <button 
              onClick={searchParticipant} 
              disabled={loading}
              style={{ padding: '14px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #C9A84C, #A88A3D)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}
            >
              {loading ? 'Recherche...' : 'Accéder à mon espace'}
            </button>
          </div>

          {error && <div style={{ color: '#E74C3C', fontSize: 14, marginTop: 16, textAlign: 'center', background: 'rgba(231,76,60,0.1)', padding: 12, borderRadius: 8 }}>{error}</div>}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>← Retour à l'accueil</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD SCREEN (after login) ───
  const sidebarItems = [
    { key: 'overview' as const, label: 'Vue d\'ensemble', icon: '📊' },
    { key: 'syllabus' as const, label: 'Programme', icon: '📅' },
    { key: 'payment' as const, label: 'Paiement', icon: '💳' },
    { key: 'documents' as const, label: 'Documents', icon: '📄' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', color: '#fff', fontFamily: "'DM Sans', sans-serif", display: 'flex' }}>
      {/* ─── SIDEBAR (Desktop) ─── */}
      <aside style={{
        width: 260, background: 'rgba(0,0,0,0.3)', borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }} className="portal-sidebar">
        <div style={{ padding: '0 24px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogoRMK scale={0.5} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>RMK × CABEXIA</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Portail Client</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => setActiveTab(item.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
                background: activeTab === item.key ? 'rgba(201,168,76,0.15)' : 'transparent',
                border: 'none', borderLeft: activeTab === item.key ? '3px solid #C9A84C' : '3px solid transparent',
                color: activeTab === item.key ? '#C9A84C' : 'rgba(255,255,255,0.6)',
                fontSize: 14, fontWeight: activeTab === item.key ? 700 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '0 24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{participant.prenom} {participant.nom}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{participant.email}</div>
          <button onClick={() => { setParticipant(null); setEmail(''); setActiveTab('overview'); }}
            style={{ marginTop: 12, background: 'none', border: 'none', color: '#E74C3C', fontSize: 12, cursor: 'pointer', padding: 0 }}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── MOBILE TOP BAR ─── */}
      <div className="portal-mobile-bar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoRMK scale={0.35} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Mon Espace</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* ─── MOBILE DROPDOWN MENU ─── */}
      {mobileMenuOpen && (
        <div className="portal-mobile-dropdown" style={{
          display: 'none', position: 'fixed', top: 52, left: 0, right: 0, zIndex: 199,
          background: 'rgba(15,23,42,0.98)', borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '8px 0',
        }}>
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => { setActiveTab(item.key); setMobileMenuOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                background: activeTab === item.key ? 'rgba(201,168,76,0.15)' : 'transparent',
                border: 'none', color: activeTab === item.key ? '#C9A84C' : 'rgba(255,255,255,0.7)',
                fontSize: 15, fontWeight: activeTab === item.key ? 700 : 500, cursor: 'pointer', textAlign: 'left',
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => { setParticipant(null); setEmail(''); setActiveTab('overview'); setMobileMenuOpen(false); }}
              style={{ background: 'none', border: 'none', color: '#E74C3C', fontSize: 13, cursor: 'pointer', padding: 0 }}>
              Déconnexion — {participant.prenom}
            </button>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main className="portal-main" style={{ flex: 1, marginLeft: 260, padding: '40px 48px', minHeight: '100vh', overflowY: 'auto' }}>

        {/* ─── TAB: OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
              Bienvenue, <span style={{ color: '#C9A84C' }}>{participant.prenom}</span> 👋
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 36 }}>Voici un récapitulatif de votre inscription.</p>

            {/* Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 36 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 20px' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Séminaire</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{seminar?.icon} {seminar?.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{seminar?.week}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 20px' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Statut</div>
                <div style={{
                  display: 'inline-block', padding: '6px 14px', borderRadius: 100, fontSize: 14, fontWeight: 700,
                  background: participant.status === 'confirmed' ? 'rgba(39,174,96,0.2)' : 'rgba(243,156,18,0.2)',
                  color: participant.status === 'confirmed' ? '#27AE60' : '#F39C12',
                }}>
                  {participant.status === 'confirmed' ? '✅ Confirmé' : '⏳ En attente de paiement'}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 20px' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Montant</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#C9A84C' }}>{Number(participant.amount || 540000).toLocaleString('fr-FR')} <span style={{ fontSize: 14 }}>FCFA</span></div>
              </div>
            </div>

            {/* Participant Info */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 28, marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>👤 Informations Personnelles</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Nom complet</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{participant.prenom} {participant.nom}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{participant.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Société</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{participant.societe || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Fonction</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{participant.fonction || '—'}</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <button onClick={() => setActiveTab('syllabus')} style={{
                padding: '20px', borderRadius: 12, border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.08)',
                color: '#C9A84C', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
                Voir le Programme Complet
                <div style={{ fontSize: 12, color: 'rgba(201,168,76,0.7)', marginTop: 4 }}>5 jours de formation détaillés</div>
              </button>
              <button onClick={() => setActiveTab('payment')} style={{
                padding: '20px', borderRadius: 12, border: '1px solid rgba(243,156,18,0.3)', background: 'rgba(243,156,18,0.08)',
                color: '#F39C12', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>💳</div>
                Instructions de Paiement
                <div style={{ fontSize: 12, color: 'rgba(243,156,18,0.7)', marginTop: 4 }}>Wave, Orange Money, Virement</div>
              </button>
              <button onClick={() => setActiveTab('documents')} style={{
                padding: '20px', borderRadius: 12, border: '1px solid rgba(39,174,96,0.3)', background: 'rgba(39,174,96,0.08)',
                color: '#27AE60', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                Mes Documents
                <div style={{ fontSize: 12, color: 'rgba(39,174,96,0.7)', marginTop: 4 }}>Attestation, facture</div>
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: SYLLABUS ─── */}
        {activeTab === 'syllabus' && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>📅 Programme du Séminaire</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 12 }}>
              {seminar?.icon} {seminar?.title} — {seminar?.week}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 36, fontStyle: 'italic' }}>
              Programme exécutif « Intelligence Artificielle Stratégique pour Dirigeants » — Développé par CABEXIA, Cabinet d'Expertise en Intelligence Artificielle
            </p>

            {/* Objectives — always visible */}
            <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', marginTop: 0, marginBottom: 14 }}>🎯 Objectifs du programme</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 2 }}>
                <li>Comprendre les transformations économiques provoquées par l'IA</li>
                <li>Développer la capacité à utiliser l'IA comme outil d'analyse et d'aide à la décision</li>
                <li>Maîtriser les techniques de prompting pour des résultats fiables et exploitables</li>
                <li>Identifier les opportunités d'intégration de l'IA dans les organisations</li>
                <li>Renforcer la capacité stratégique face aux transformations technologiques</li>
              </ul>
            </div>

            {/* 5 Axes du Programme */}
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: '#fff' }}>Contenu du Programme</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>
              Le programme est structuré autour de 5 axes permettant de développer une maîtrise progressive et opérationnelle de l'intelligence artificielle.
            </p>

            {(() => {
              const isUnlocked = participant.status === 'confirmed';
              const axes = [
                {
                  title: "IA et transformation du leadership",
                  icon: "🏛️",
                  color: "#C9A84C",
                  points: [
                    "Comprendre les transformations économiques liées à l'IA",
                    "Le rôle du dirigeant dans l'économie algorithmique",
                    "Les opportunités et limites de l'intelligence artificielle générative",
                    "L'IA comme levier de transformation organisationnelle",
                  ]
                },
                {
                  title: "Prompt engineering stratégique",
                  icon: "⚡",
                  color: "#C9A84C",
                  points: [
                    "Comprendre pourquoi la qualité des résultats dépend de la qualité des prompts",
                    "Structure d'un prompt professionnel efficace",
                    "Techniques avancées pour dialoguer efficacement avec l'IA",
                    "Construction de prompts pour l'analyse stratégique et la prise de décision",
                  ]
                },
                {
                  title: "IA et décision augmentée",
                  icon: "📊",
                  color: "#2563EB",
                  points: [
                    "Analyse stratégique assistée par l'intelligence artificielle",
                    "Simulation de scénarios de décision",
                    "Utilisation de l'IA pour l'intelligence économique",
                    "Analyse de données et production de synthèses exécutives",
                  ]
                },
                {
                  title: "IA dans les fonctions clés de l'organisation",
                  icon: "🏢",
                  color: "#2563EB",
                  points: [
                    "Applications dans le management et la gouvernance",
                    "Applications dans les ressources humaines et le leadership",
                    "Applications dans le marketing et la stratégie commerciale",
                    "Applications dans l'analyse financière et la gestion des performances",
                  ]
                },
                {
                  title: "Gouvernance et responsabilité",
                  icon: "🛡️",
                  color: "#27AE60",
                  points: [
                    "Confidentialité et protection des données",
                    "Risques liés aux biais algorithmiques",
                    "Responsabilité managériale dans l'usage de l'IA",
                    "Bonnes pratiques d'utilisation dans un contexte professionnel",
                  ]
                },
              ];

              return (
                <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
                  {axes.map((axe, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 14, padding: 24, borderLeft: `3px solid ${axe.color}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isUnlocked ? 14 : 0 }}>
                        <span style={{ fontSize: 22 }}>{axe.icon}</span>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
                          Axe {i + 1} — {axe.title}
                        </h3>
                      </div>
                      {isUnlocked ? (
                        <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.9 }}>
                          {axe.points.map((p, j) => (
                            <li key={j}>{p}</li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ 
                          marginTop: 10, padding: '8px 14px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.02)', 
                          color: 'rgba(255,255,255,0.25)', fontSize: 13,
                          filter: 'blur(3px)', userSelect: 'none',
                        }}>
                          {axe.points.length} modules détaillés · Contenu réservé aux participants confirmés
                        </div>
                      )}
                    </div>
                  ))}

                  {!isUnlocked && (
                    <div style={{
                      padding: 20, borderRadius: 12, textAlign: 'center',
                      background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                    }}>
                      <span style={{ fontSize: 24 }}>🔒</span>
                      <p style={{ color: '#C9A84C', fontWeight: 700, fontSize: 15, margin: '8px 0 4px' }}>
                        Programme complet débloqué après validation du paiement
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                        Validez votre paiement pour accéder au détail de chaque axe, à la méthodologie pédagogique et aux supports de cours.
                      </p>
                      <button onClick={() => setActiveTab('payment')} style={{
                        marginTop: 16, padding: '10px 24px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #C9A84C, #A88A3D)', border: 'none',
                        color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}>
                        Voir les instructions de paiement →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Methodology — only when confirmed */}
            {participant.status === 'confirmed' && (
              <div style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)', borderRadius: 14, padding: 24, marginBottom: 28 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#27AE60', marginTop: 0, marginBottom: 14 }}>🧪 Méthodologie Pédagogique</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
                  Le programme repose sur une approche pédagogique immersive orientée vers l'action :
                </p>
                <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 2 }}>
                  <li>Démonstrations pratiques d'utilisation des outils d'intelligence artificielle</li>
                  <li>Ateliers intensifs de prompt engineering</li>
                  <li>Études de cas inspirées de situations réelles</li>
                  <li>Simulations de prise de décision stratégique</li>
                  <li>Travail collaboratif entre participants</li>
                </ul>
              </div>
            )}

            {/* Expected Results — always visible */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 0, marginBottom: 14 }}>🎓 Résultats Attendus</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 12 }}>À l'issue du programme, les participants seront capables de :</p>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 2 }}>
                <li>Comprendre les enjeux stratégiques de l'intelligence artificielle</li>
                <li>Utiliser efficacement les outils d'IA générative</li>
                <li>Maîtriser les techniques de prompting stratégique</li>
                <li>Exploiter l'IA pour améliorer la prise de décision</li>
                <li>Identifier les opportunités d'intégration de l'IA dans leur organisation</li>
              </ul>
            </div>

            {/* Public cible */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 0, marginBottom: 14 }}>👥 Public Cible</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {["Dirigeants d'entreprises", "Directeurs généraux", "Cadres dirigeants", "Managers", "Responsables de départements", "Décideurs publics"].map((p, i) => (
                  <span key={i} style={{ padding: '6px 14px', borderRadius: 100, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', fontSize: 13, fontWeight: 600 }}>{p}</span>
                ))}
              </div>
            </div>

            {/* Logistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>🏨</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Lieu</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Hôtel Movenpick, Abidjan — Plateau</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>⏰</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Horaires</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>08h30 — 17h00 (Pause déjeuner incluse)</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>💻</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Matériel</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Apportez votre laptop. Wi-Fi et supports fournis.</div>
              </div>
            </div>

            {/* CABEXIA footer */}
            <div style={{ marginTop: 32, textAlign: 'center', padding: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
                « L'intelligence artificielle ne remplacera pas les dirigeants. Mais les dirigeants qui maîtrisent l'intelligence artificielle remplaceront ceux qui ne la maîtrisent pas. »
              </p>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 8 }}>
                CABEXIA — Cabinet d'Expertise en Intelligence Artificielle
              </p>
            </div>
          </div>
        )}

        {/* ─── TAB: PAYMENT ─── */}
        {activeTab === 'payment' && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>💳 Paiement</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 36 }}>Réglez votre inscription pour confirmer définitivement votre place.</p>

            {/* Amount Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))',
              border: '1px solid rgba(201,168,76,0.3)', borderRadius: 16, padding: 32, marginBottom: 28, textAlign: 'center',
            }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Montant Total</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: '#C9A84C' }}>{Number(participant.amount || 540000).toLocaleString('fr-FR')} <span style={{ fontSize: 20 }}>FCFA</span></div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>{seminar?.title} — {seminar?.week}</div>
            </div>

            {/* Status */}
            <div style={{
              padding: '16px 20px', borderRadius: 12, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12,
              background: participant.status === 'confirmed' ? 'rgba(39,174,96,0.1)' : 'rgba(243,156,18,0.1)',
              border: `1px solid ${participant.status === 'confirmed' ? 'rgba(39,174,96,0.3)' : 'rgba(243,156,18,0.3)'}`,
            }}>
              <span style={{ fontSize: 24 }}>{participant.status === 'confirmed' ? '✅' : '⏳'}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: participant.status === 'confirmed' ? '#27AE60' : '#F39C12' }}>
                  {participant.status === 'confirmed' ? 'Paiement validé' : 'En attente de paiement'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  {participant.status === 'confirmed' ? 'Votre place est confirmée. Bienvenue !' : 'Envoyez votre preuve de paiement par WhatsApp pour validation.'}
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            {participant.status !== 'confirmed' && (
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Moyens de paiement acceptés</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  <div style={{ background: 'rgba(0,191,165,0.1)', border: '1px solid rgba(0,191,165,0.3)', borderRadius: 14, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>🌊</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#00BFA5' }}>Wave</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>+225 07 00 00 00 00</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Envoyez le montant exact et transmettez la capture de reçu via WhatsApp.</div>
                  </div>
                  <div style={{ background: 'rgba(255,102,0,0.1)', border: '1px solid rgba(255,102,0,0.3)', borderRadius: 14, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>🟧</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#FF6600' }}>Orange Money</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>+225 07 00 00 00 00</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Envoyez le montant exact et transmettez la capture de reçu via WhatsApp.</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>🏦</span>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>Virement Bancaire</span>
                    </div>
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>Contactez-nous par WhatsApp ou email pour les coordonnées bancaires et la facturation entreprise.</div>
                  </div>
                </div>

                <div style={{ marginTop: 28, padding: 20, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>📱 Envoyez votre reçu par WhatsApp à :</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#27AE60' }}>+225 07 00 00 00 00</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>Votre statut sera mis à jour sous 2h après réception du reçu.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: DOCUMENTS ─── */}
        {activeTab === 'documents' && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>📄 Mes Documents</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 36 }}>Téléchargez vos documents officiels liés à la formation.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {/* Attestation */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🎓</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 8 }}>Attestation de Formation</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 20 }}>
                  Document officiel certifiant votre participation au séminaire. Délivré par RMK Conseils & CABEXIA.
                </p>
                {participant.status === 'confirmed' ? (
                  <button onClick={exportAttestation} style={{
                    width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#27AE60',
                    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    ⬇️ Télécharger (PDF)
                  </button>
                ) : (
                  <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                    🔒 Disponible après confirmation du paiement
                  </div>
                )}
              </div>

              {/* Facture */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🧾</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 8 }}>Facture Proforma</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 20 }}>
                  Facture proforma pour votre entreprise ou service comptable. Montant TTC inclus.
                </p>
                <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  📧 Disponible sur demande par email
                </div>
              </div>

              {/* Support de cours */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 8 }}>Support de Cours</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 20 }}>
                  Slides, exercices et ressources complémentaires du séminaire. Distribués le Jour 1.
                </p>
                <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  🔒 Disponible à partir du {seminar?.week.split('–')[0]}Mai
                </div>
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
