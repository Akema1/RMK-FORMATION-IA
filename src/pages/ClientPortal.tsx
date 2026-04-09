import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import jsPDF from 'jspdf';

const SEMINARS = [
  { id:"s1", code:"S1", title:"IA Stratégique pour Dirigeants", week:"5–9 Mai 2026" },
  { id:"s2", code:"S2", title:"IA appliquée à la Finance", week:"12–16 Mai 2026" },
  { id:"s3", code:"S3", title:"IA pour les Notaires", week:"19–23 Mai 2026" },
  { id:"s4", code:"S4", title:"IA pour les Ressources Humaines", week:"26–30 Mai 2026" },
];

import { LogoRMK } from "../components/LogoRMK";

export default function ClientPortal() {
  const [email, setEmail] = useState('');
  const [participant, setParticipant] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const searchParticipant = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    setParticipant(null);
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('email', email)
        .single();
      
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

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', color: '#fff', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 500, width: '100%', background: 'rgba(255,255,255,0.05)', padding: 40, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <LogoRMK scale={0.8} />
          <div style={{ color: '#E8651A', fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', marginTop: 12 }}>Portail Client</div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>Mon Espace Formation</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>Entrez l'adresse email utilisée lors de votre inscription pour accéder à vos documents.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="votre.email@entreprise.com" 
            style={{ padding: '14px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 16, outline: 'none' }}
            onKeyDown={e => e.key === 'Enter' && searchParticipant()}
          />
          <button 
            onClick={searchParticipant} 
            disabled={loading}
            style={{ padding: '14px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #E8651A, #D4580F)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Recherche...' : 'Accéder à mon espace'}
          </button>
        </div>

        {error && <div style={{ color: '#E74C3C', fontSize: 14, marginTop: 16, textAlign: 'center', background: 'rgba(231,76,60,0.1)', padding: 12, borderRadius: 8 }}>{error}</div>}

        {participant && (
          <div style={{ marginTop: 32, padding: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#60E0E0' }}>Bonjour {participant.prenom} {participant.nom}</h3>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Séminaire</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{SEMINARS.find(s => s.id === participant.seminar)?.title}</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Statut de l'inscription</div>
              <div style={{ 
                display: 'inline-block', marginTop: 4, padding: '4px 12px', borderRadius: 100, fontSize: 13, fontWeight: 700,
                background: participant.status === 'confirmed' ? 'rgba(39,174,96,0.2)' : participant.status === 'pending' ? 'rgba(243,156,18,0.2)' : 'rgba(231,76,60,0.2)',
                color: participant.status === 'confirmed' ? '#27AE60' : participant.status === 'pending' ? '#F39C12' : '#E74C3C'
              }}>
                {participant.status === 'confirmed' ? 'Confirmé' : participant.status === 'pending' ? 'En attente de paiement' : 'Annulé'}
              </div>
            </div>

            {participant.status === 'confirmed' ? (
              <button 
                onClick={exportAttestation}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#2980B9', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <span>🎓</span> Télécharger mon attestation
              </button>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                Votre attestation sera disponible ici une fois votre inscription confirmée.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
