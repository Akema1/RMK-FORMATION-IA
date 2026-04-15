import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { fmt } from '../data/seminars';
import { card, inputS, selectS, btnPrimary, label, ORANGE } from './config';
import type { Seminar, Participant } from './types';

interface CertificatePageProps {
  seminars: Seminar[];
  participants: Participant[];
}

const NAVY = '#1B2A4A';
const GOLD = '#C9A84C';

export function CertificatePage({ seminars, participants }: CertificatePageProps) {
  const [mode, setMode] = useState<'participant' | 'manual'>('participant');
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [manual, setManual] = useState({ prenom: '', nom: '', societe: '', fonction: '', seminarId: seminars[0]?.id || '' });
  const [generating, setGenerating] = useState(false);

  const confirmed = participants.filter(p => p.status === 'confirmed');

  const generateCertificate = (prenom: string, nom: string, societe: string, fonction: string, seminar: Seminar) => {
    setGenerating(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210, cx = W / 2;

    const navy: [number, number, number] = [27, 42, 74];
    const gold: [number, number, number] = [201, 168, 76];
    const lightGold: [number, number, number] = [230, 210, 150];
    const paleBlue: [number, number, number] = [230, 236, 248];
    const textGray: [number, number, number] = [100, 100, 100];
    const lightGray: [number, number, number] = [180, 180, 180];
    const navyLight: [number, number, number] = [40, 58, 95];

    // Pale blue background
    doc.setFillColor(...paleBlue);
    doc.rect(0, 0, W, H, 'F');

    // Navy top/bottom bands + gold accent
    doc.setFillColor(...navy); doc.rect(0, 0, W, 5, 'F'); doc.rect(0, H - 5, W, 5, 'F');
    doc.setFillColor(...gold); doc.rect(0, 5, W, 1, 'F'); doc.rect(0, H - 6, W, 1, 'F');

    // Double border
    doc.setDrawColor(...navyLight); doc.setLineWidth(0.4); doc.rect(8, 10, W - 16, H - 20);
    doc.setDrawColor(...gold); doc.setLineWidth(1.2); doc.rect(12, 14, W - 24, H - 28);

    // Gold corner L-brackets
    const cLen = 18, ins = 18;
    doc.setLineWidth(1.8); doc.setDrawColor(...gold);
    doc.line(ins, ins, ins + cLen, ins); doc.line(ins, ins, ins, ins + cLen);
    doc.line(W - ins, ins, W - ins - cLen, ins); doc.line(W - ins, ins, W - ins, ins + cLen);
    doc.line(ins, H - ins, ins + cLen, H - ins); doc.line(ins, H - ins, ins, H - ins - cLen);
    doc.line(W - ins, H - ins, W - ins - cLen, H - ins); doc.line(W - ins, H - ins, W - ins, H - ins - cLen);

    // Diamond ornaments
    const drawDiamond = (dx: number, dy: number, sz: number) => {
      doc.setFillColor(...gold);
      doc.triangle(dx, dy - sz, dx + sz, dy, dx, dy + sz, 'F');
      doc.triangle(dx, dy - sz, dx - sz, dy, dx, dy + sz, 'F');
    };
    drawDiamond(ins, ins, 2); drawDiamond(W - ins, ins, 2);
    drawDiamond(ins, H - ins, 2); drawDiamond(W - ins, H - ins, 2);

    // Triple-line divider
    const drawTripleLine = (y: number, mx: number) => {
      doc.setDrawColor(...lightGold); doc.setLineWidth(0.2); doc.line(mx, y - 1.5, W - mx, y - 1.5);
      doc.setDrawColor(...gold); doc.setLineWidth(0.7); doc.line(mx, y, W - mx, y);
      doc.setDrawColor(...lightGold); doc.setLineWidth(0.2); doc.line(mx, y + 1.5, W - mx, y + 1.5);
    };

    let curY = 30;

    // Issuers
    doc.setFont('times', 'bold'); doc.setFontSize(10); doc.setTextColor(...gold);
    doc.text('R M K   C O N S E I L S     \u00D7     C A B E X I A', cx, curY, { align: 'center' });
    curY += 14;

    // Title
    doc.setFont('times', 'bold'); doc.setFontSize(28); doc.setTextColor(...navy);
    doc.text('ATTESTATION DE FORMATION', cx, curY, { align: 'center' });
    curY += 8;
    drawTripleLine(curY, 60); curY += 6;
    drawDiamond(cx, curY, 2.2); curY += 10;

    // Certification text
    doc.setFont('times', 'italic'); doc.setFontSize(12); doc.setTextColor(...textGray);
    doc.text('Nous certifions que', cx, curY, { align: 'center' }); curY += 14;

    // Participant name
    doc.setFont('times', 'bolditalic'); doc.setFontSize(26); doc.setTextColor(...navy);
    const fullName = `${prenom} ${nom}`.toUpperCase();
    doc.text(fullName, cx, curY, { align: 'center' }); curY += 6;
    const nameW = doc.getTextWidth(fullName);
    doc.setDrawColor(...lightGold); doc.setLineWidth(0.3);
    doc.line(cx - nameW / 2 - 5, curY, cx + nameW / 2 + 5, curY); curY += 7;

    // Company + function
    if (societe || fonction) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...textGray);
      doc.text([societe, fonction].filter(Boolean).join('  \u2014  '), cx, curY, { align: 'center' }); curY += 8;
    }

    doc.setFont('times', 'italic'); doc.setFontSize(12); doc.setTextColor(...textGray);
    doc.text('a suivi avec succ\u00E8s la formation :', cx, curY, { align: 'center' }); curY += 12;

    // Seminar title
    doc.setFont('times', 'bold'); doc.setFontSize(20); doc.setTextColor(...navy);
    const semTitle = `\u00AB  ${seminar.title}  \u00BB`;
    doc.text(semTitle, cx, curY, { align: 'center' }); curY += 3;
    const stW = doc.getTextWidth(semTitle);
    doc.setDrawColor(...gold); doc.setLineWidth(0.6);
    doc.line(cx - stW / 2 + 10, curY, cx + stW / 2 - 10, curY); curY += 10;

    // Dates + location
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...textGray);
    doc.text(`${seminar.week}  \u2014  Abidjan, C\u00F4te d'Ivoire`, cx, curY, { align: 'center' }); curY += 7;
    doc.setFontSize(10); doc.setTextColor(...lightGray);
    doc.text('Formation hybride : 3 jours pr\u00E9sentiel  +  2 sessions en ligne', cx, curY, { align: 'center' }); curY += 8;

    drawTripleLine(curY, 50); curY += 4;
    drawDiamond(cx, curY, 2.2); curY += 10;

    // Signatures
    const sigL = 80, sigR = W - 80, sigHalf = 35;
    doc.setDrawColor(...gold); doc.setLineWidth(0.4);
    doc.line(sigL - sigHalf, curY, sigL + sigHalf, curY);
    doc.line(sigR - sigHalf, curY, sigR + sigHalf, curY); curY += 5;
    doc.setFont('times', 'bold'); doc.setFontSize(10); doc.setTextColor(...navy);
    doc.text('Le Directeur G\u00E9n\u00E9ral', sigL, curY, { align: 'center' });
    doc.text("L'Expert Formateur", sigR, curY, { align: 'center' }); curY += 5;
    doc.setFont('times', 'italic'); doc.setFontSize(9); doc.setTextColor(...textGray);
    doc.text('RMK Conseils', sigL, curY, { align: 'center' });
    doc.text('CABEXIA', sigR, curY, { align: 'center' });

    // Footer
    const footY = H - 18;
    doc.setDrawColor(...lightGold); doc.setLineWidth(0.2); doc.line(40, footY - 3, W - 40, footY - 3);
    const ref = `ATT-${seminar.code}-${nom.substring(0, 3).toUpperCase()}${String(Date.now()).slice(-4)}`;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...lightGray);
    doc.text(`R\u00E9f\u00E9rence : ${ref}`, 30, footY);
    doc.text(`D\u00E9livr\u00E9 le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, cx, footY, { align: 'center' });
    drawDiamond(cx, footY + 4, 1.2);

    doc.save(`Attestation_${nom}_${seminar.code}.pdf`);
    setGenerating(false);
  };

  const handleGenerate = () => {
    if (mode === 'participant') {
      const p = confirmed.find(x => x.id === selectedParticipant);
      const s = p ? seminars.find(x => x.id === p.seminar) : null;
      if (p && s) generateCertificate(p.prenom, p.nom, p.societe || '', p.fonction || '', s);
    } else {
      const s = seminars.find(x => x.id === manual.seminarId);
      if (manual.prenom && manual.nom && s) generateCertificate(manual.prenom, manual.nom, manual.societe, manual.fonction, s);
    }
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={() => setMode('participant')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: mode === 'participant' ? `${GOLD}22` : 'rgba(0,0,0,0.04)', color: mode === 'participant' ? NAVY : '#64748B' }}>
          Depuis un participant inscrit
        </button>
        <button onClick={() => setMode('manual')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: mode === 'manual' ? `${GOLD}22` : 'rgba(0,0,0,0.04)', color: mode === 'manual' ? NAVY : '#64748B' }}>
          Saisie manuelle
        </button>
      </div>

      <div style={card}>
        {mode === 'participant' ? (
          <div>
            <h3 style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Generer depuis un participant confirme</h3>
            {confirmed.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 14 }}>Aucun participant confirme. Les attestations sont disponibles pour les participants avec le statut "confirmed".</p>
            ) : (
              <div>
                <label style={label}>Participant</label>
                <select style={selectS} value={selectedParticipant} onChange={e => setSelectedParticipant(e.target.value)}>
                  <option value="">-- Choisir un participant --</option>
                  {confirmed.map(p => {
                    const s = seminars.find(x => x.id === p.seminar);
                    return <option key={p.id} value={p.id}>{p.prenom} {p.nom} — {s?.code || '?'} ({s?.title || ''})</option>;
                  })}
                </select>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Saisie manuelle</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={label}>Prenom</label><input style={inputS} value={manual.prenom} onChange={e => setManual({ ...manual, prenom: e.target.value })} placeholder="Ex: Aminata" /></div>
              <div><label style={label}>Nom</label><input style={inputS} value={manual.nom} onChange={e => setManual({ ...manual, nom: e.target.value })} placeholder="Ex: Coulibaly" /></div>
              <div><label style={label}>Societe</label><input style={inputS} value={manual.societe} onChange={e => setManual({ ...manual, societe: e.target.value })} placeholder="Ex: SGBCI" /></div>
              <div><label style={label}>Fonction</label><input style={inputS} value={manual.fonction} onChange={e => setManual({ ...manual, fonction: e.target.value })} placeholder="Ex: Directrice Financiere" /></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={label}>Seminaire</label>
              <select style={selectS} value={manual.seminarId} onChange={e => setManual({ ...manual, seminarId: e.target.value })}>
                {seminars.map(s => <option key={s.id} value={s.id}>{s.code} — {s.title} ({s.week})</option>)}
              </select>
            </div>
          </div>
        )}

        <button onClick={handleGenerate} disabled={generating} style={{ ...btnPrimary, marginTop: 20, opacity: generating ? 0.6 : 1 }}>
          {generating ? 'Generation...' : '🎓 Generer le Certificat PDF'}
        </button>
      </div>

      {/* Preview description */}
      <div style={{ ...card, marginTop: 24, background: 'rgba(27,42,74,0.03)', border: '1px solid rgba(27,42,74,0.08)' }}>
        <h3 style={{ color: NAVY, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Apercu du certificat</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 12, color: '#64748B' }}>
          <div>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Format</div>
            A4 Paysage (297 × 210 mm)
          </div>
          <div>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Palette</div>
            Navy / Gold / Pale Blue / Ivory
          </div>
          <div>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Elements</div>
            Coins dores, triple lignes, diamants, signatures
          </div>
        </div>
      </div>
    </div>
  );
}
