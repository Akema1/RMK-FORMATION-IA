import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LogoRMK } from '../components/LogoRMK';
import { selectS, inputS, btnPrimary } from './config';
import type { Seminar } from './types';

interface FlyerPageProps {
  seminars: Seminar[];
}

export function FlyerPage({ seminars }: FlyerPageProps) {
  const [flyerId, setFlyerId] = useState(seminars[0]?.id || "s1");
  const [customImage, setCustomImage] = useState("");
  const flyerRef = useRef<HTMLDivElement>(null);
  const s = seminars.find(x => x.id === flyerId) || seminars[0];

  if (!s) return <div style={{ padding: 24, color: '#1B2A4A' }}>Aucun atelier disponible pour le flyer.</div>;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: 0 }}>Générateur de Flyer Individuel</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <select style={{ ...selectS, width: "auto" }} value={flyerId} onChange={e => setFlyerId(e.target.value)}>
            {seminars.map(sem => <option key={sem.id} value={sem.id}>{sem.code} - {sem.title}</option>)}
          </select>
          <button onClick={exportPNG} style={{ ...btnPrimary, background: "#2980B9" }}>Export PNG</button>
          <button onClick={exportPDF} style={btnPrimary}>Export PDF</button>
        </div>
      </div>

      <div style={{ background: "rgba(0,0,0,0.05)", padding: 16, borderRadius: 8, marginBottom: 24, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", color: '#1B2A4A', fontSize: 12, marginBottom: 4 }}>URL de l'image personnalisée (optionnel)</label>
          <input type="text" value={customImage} onChange={e => setCustomImage(e.target.value)} placeholder="Collez le lien d'une image ici pour remplacer celle par défaut..." style={{ ...inputS, width: "100%" }} />
        </div>
        <p style={{ color: '#1B2A4A', fontSize: 12, margin: 0, maxWidth: 300 }}>
          Cliquez sur les boutons d'export ci-dessus pour générer une image ou un PDF parfaitement dimensionné (1000x1000).
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div ref={flyerRef} className="printable-flyer" style={{ width: 1000, height: 1000, background: "#FAF9F6", position: "relative", overflow: "hidden", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 20px 50px rgba(0,0,0,0.5)", borderRadius: 8 }}>
          {/* Background decorations */}
          <div style={{ position: "absolute", top: -150, left: -150, width: 400, height: 400, background: "radial-gradient(circle, rgba(96,224,224,0.15) 0%, rgba(0,0,0,0) 70%)" }} />
          <div style={{ position: "absolute", top: 100, right: 100, width: 600, height: 600, background: "radial-gradient(circle, rgba(96,224,224,0.05) 0%, rgba(0,0,0,0) 70%)" }} />

          {/* Right Image */}
          <div style={{ position: "absolute", right: 0, bottom: 0, width: 450, height: "85%", backgroundImage: `url(${finalImage})`, backgroundSize: "cover", backgroundPosition: "center top", borderTopLeftRadius: 400, borderBottomLeftRadius: 0, boxShadow: "-10px 0 40px rgba(0,0,0,0.5)", zIndex: 5 }} />

          {/* Content Container */}
          <div style={{ position: "relative", zIndex: 10, padding: "40px 50px", width: "65%", height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Logos */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
              <LogoRMK scale={1} variant="light" />
              <span style={{ fontSize: 24, color: "#C9A84C" }}>×</span>
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
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://rmkconsulting.pro/inscription" alt="QR Code" style={{ width: "100%", height: "100%" }} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 80, background: "#fff", padding: "0 40px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1B2A4A", fontSize: 16, fontWeight: 700 }}>
              +225 07 02 61 15 82 WhatsApp
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1B2A4A", fontSize: 16, fontWeight: 700 }}>
              contact@rmkconsulting.pro
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .printable-flyer, .printable-flyer * { visibility: visible; }
          .printable-flyer { position: absolute; left: 0; top: 0; width: 1000px; height: 1000px; box-shadow: none; border-radius: 0; }
        }
      ` }} />
    </div>
  );
}
