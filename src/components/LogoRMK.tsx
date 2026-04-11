import React from 'react';

/**
 * LogoRMK — Utilise l'image originale fournie par l'utilisateur.
 * 
 * @param scale - Size multiplier 
 * @param variant - "dark" for dark backgrounds (nécessite logo-white.png), "light" for light backgrounds (nécessite logo.png)
 */
export function LogoRMK({ 
  scale = 1, 
  variant = 'light',
  showFrame = true // Gardé pour la compatibilité des props
}: { 
  scale?: number; 
  variant?: 'dark' | 'light';
  showFrame?: boolean;
}) {
  const w = 140 * scale;
  
  // Sélectionnez le ficher d'image en fonction de la variante "clair" (texte noir) ou "foncé" (texte blanc)
  const imageSrc = variant === 'dark' ? '/logo-white.png' : '/logo.png';

  return (
    <img 
      src={imageSrc} 
      alt="RMK Conseils" 
      width={w} 
      style={{ 
        objectFit: 'contain', 
        display: 'block' 
      }} 
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
  const h = 28 * scale;
  const imageSrc = variant === 'dark' ? '/logo-white.png' : '/logo.png';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 * scale }}>
      <img 
        src={imageSrc} 
        alt="RMK Conseils" 
        height={h} 
        style={{ objectFit: 'contain' }} 
      />
    </div>
  );
}
