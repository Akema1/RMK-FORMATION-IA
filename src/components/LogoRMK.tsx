import React, { useState } from 'react';

/**
 * LogoRMK — Utilise l'image originale fournie par l'utilisateur avec un texte de secours si non trouvée.
 */
export function LogoRMK({ 
  scale = 1, 
  variant = 'light',
  showFrame = true,
  forceText = false
}: { 
  scale?: number; 
  variant?: 'dark' | 'light';
  showFrame?: boolean;
  forceText?: boolean;
}) {
  const [error, setError] = useState(false);
  const w = 140 * scale;
  
  const imageSrc = variant === 'dark' ? '/logo-white.png' : '/logo.png';
  const textColor = variant === 'dark' ? '#FFFFFF' : '#1B2A4A';

  if (error || forceText) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: w }}>
        <span style={{ fontSize: 24 * scale, fontWeight: 800, color: textColor, letterSpacing: 1 }}>RMK</span>
        <span style={{ fontSize: 10 * scale, fontWeight: 600, color: '#C9A84C', letterSpacing: 3, textTransform: 'uppercase' }}>Conseils</span>
      </div>
    );
  }

  return (
    <img 
      src={imageSrc} 
      alt="RMK Conseils" 
      width={w} 
      style={{ objectFit: 'contain', display: 'block' }} 
      onError={() => setError(true)}
    />
  );
}

/**
 * Compact inline logo for tight spaces (navbar, footer, sidebar).
 */
export function LogoRMKInline({ 
  scale = 1, 
  variant = 'dark' 
}: { 
  scale?: number; 
  variant?: 'dark' | 'light'; 
}) {
  const [error, setError] = useState(false);
  const h = 28 * scale;
  const imageSrc = variant === 'dark' ? '/logo-white.png' : '/logo.png';
  const textColor = variant === 'dark' ? '#FFFFFF' : '#1B2A4A';

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 15 * scale, fontWeight: 800, color: textColor, letterSpacing: 1 }}>RMK</span>
          <span style={{ fontSize: 6.5 * scale, fontWeight: 600, color: '#C9A84C', letterSpacing: 3, textTransform: 'uppercase' }}>Conseils</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 * scale }}>
      <img 
        src={imageSrc} 
        alt="RMK" 
        height={h} 
        style={{ objectFit: 'contain' }} 
        onError={() => setError(true)}
      />
    </div>
  );
}
