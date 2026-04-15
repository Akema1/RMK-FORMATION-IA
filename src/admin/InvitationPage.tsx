import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LogoRMK } from '../components/LogoRMK';
import { card, inputS, selectS, btnPrimary, label, ORANGE } from './config';
import type { Seminar } from './types';

interface InvitationPageProps {
  seminars: Seminar[];
}

const NAVY = '#1B2A4A';
const GOLD = '#C9A84C';

export function InvitationPage({ seminars }: InvitationPageProps) {
  const [form, setForm] = useState({
    destinataire: '', titre: '', seminarId: seminars[0]?.id || '',
    message: 'Nous avons le plaisir de vous inviter a notre seminaire de formation en Intelligence Artificielle.',
    lieu: 'Hotel Movenpick, Abidjan',
  });
  const invRef = useRef<HTMLDivElement>(null);
  const s = seminars.find(x => x.id === form.seminarId) || seminars[0];

  const exportPNG = async () => {
    if (!invRef.current) return;
    const canvas = await html2canvas(invRef.current, { scale: 2, useCORS: true });
    const link = document.createElement('a');
    link.download = `Invitation_RMK_${s?.code || 'SEM'}_${form.destinataire.replace(/\s+/g, '_') || 'invite'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportPDF = async () => {
    if (!invRef.current) return;
    const canvas = await html2canvas(invRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 500] });
    pdf.addImage(imgData, 'PNG', 0, 0, 800, 500);
    pdf.save(`Invitation_RMK_${s?.code || 'SEM'}_${form.destinataire.replace(/\s+/g, '_') || 'invite'}.pdf`);
  };

  return (
    <div>
      {/* Form */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h3 style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Personnaliser l'invitation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={label}>Nom du destinataire</label><input style={inputS} value={form.destinataire} onChange={e => setForm({ ...form, destinataire: e.target.value })} placeholder="Ex: M. Kouame Eric" /></div>
          <div><label style={label}>Titre / Fonction</label><input style={inputS} value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Ex: Directeur General, SGBCI" /></div>
          <div><label style={label}>Seminaire</label>
            <select style={selectS} value={form.seminarId} onChange={e => setForm({ ...form, seminarId: e.target.value })}>
              {seminars.map(sem => <option key={sem.id} value={sem.id}>{sem.code} — {sem.title}</option>)}
            </select>
          </div>
          <div><label style={label}>Lieu</label><input style={inputS} value={form.lieu} onChange={e => setForm({ ...form, lieu: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={label}>Message personnalise</label>
          <textarea style={{ ...inputS, height: 60, resize: 'vertical' }} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={exportPNG} style={{ ...btnPrimary, background: '#2980B9' }}>Export PNG</button>
          <button onClick={exportPDF} style={btnPrimary}>Export PDF</button>
        </div>
      </div>

      {/* Live preview */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div ref={invRef} style={{
          width: 800, height: 500, background: '#FAF9F6', position: 'relative', overflow: 'hidden',
          fontFamily: "'DM Sans', sans-serif", boxShadow: '0 16px 48px rgba(0,0,0,0.15)', borderRadius: 8,
        }}>
          {/* Navy header band */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, background: NAVY }} />

          {/* Gold accent line */}
          <div style={{ position: 'absolute', top: 140, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${GOLD}, transparent 30%, transparent 70%, ${GOLD})` }} />

          {/* Logo area */}
          <div style={{ position: 'relative', zIndex: 1, padding: '28px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <LogoRMK scale={0.8} variant="dark" />
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>INVITATION</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 2 }}>RMK CONSEILS × CABEXIA</div>
            </div>
          </div>

          {/* Seminar title */}
          <div style={{ position: 'relative', zIndex: 1, padding: '16px 48px 0' }}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{s?.title || 'Seminaire'}</div>
            <div style={{ color: GOLD, fontSize: 12, fontWeight: 600, marginTop: 4 }}>{s?.code} · {s?.week}</div>
          </div>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1, padding: '32px 48px 0' }}>
            {/* Destinataire */}
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>A l'attention de</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, marginBottom: 2 }}>
              {form.destinataire || 'Nom du destinataire'}
            </div>
            {form.titre && <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>{form.titre}</div>}

            {/* Message */}
            <div style={{ marginTop: 20, fontSize: 13, color: NAVY, lineHeight: 1.7, maxWidth: 500 }}>
              {form.message}
            </div>

            {/* Location + Date */}
            <div style={{ display: 'flex', gap: 40, marginTop: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>Lieu</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{form.lieu}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>Date</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{s?.week}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>Format</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>3j presentiel + 2j en ligne</div>
              </div>
            </div>
          </div>

          {/* QR Code + Contact footer */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: NAVY,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 48px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 4, padding: 2 }}>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://rmkconsulting.pro/inscription" alt="QR" style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ color: GOLD, fontSize: 11, fontWeight: 600 }}>Scannez pour vous inscrire</div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>+225 07 02 61 15 82</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>contact@rmkconsulting.pro</span>
            </div>
          </div>

          {/* Decorative gold corner accents */}
          <div style={{ position: 'absolute', top: 148, left: 36, width: 24, height: 2, background: GOLD }} />
          <div style={{ position: 'absolute', top: 148, left: 36, width: 2, height: 24, background: GOLD }} />
          <div style={{ position: 'absolute', top: 148, right: 36, width: 24, height: 2, background: GOLD }} />
          <div style={{ position: 'absolute', top: 148, right: 36, width: 2, height: 24, background: GOLD }} />
        </div>
      </div>
    </div>
  );
}
