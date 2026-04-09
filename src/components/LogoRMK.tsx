import React from 'react';

export function LogoRMK({ scale = 1 }: { scale?: number }) {
  return (
    <div style={{ background: "#fff", padding: `${12 * scale}px ${24 * scale}px`, borderRadius: 8 * scale, color: "#000", display: "flex", flexDirection: "column", alignItems: "center", border: `${2 * scale}px solid #F2A900` }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36 * scale, fontWeight: 800, lineHeight: 1 }}>RMK</div>
      <div style={{ fontSize: 10 * scale, fontWeight: 800, letterSpacing: 3 }}>CONSEILS</div>
    </div>
  );
}
