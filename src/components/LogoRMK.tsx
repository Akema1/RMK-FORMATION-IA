import React from 'react';

/**
 * LogoRMK — Faithful SVG reproduction of the RMK Conseils logo.
 * 
 * Design elements from the original:
 * - "RMK" in elegant high-contrast serif letterforms (black)
 * - "CONSEILS" in wide-tracked uppercase below
 * - Gold rectangular frame offset to the right
 * 
 * @param scale - Size multiplier (1 = ~120px wide)
 * @param variant - "dark" for dark backgrounds (white letters), "light" for light backgrounds (black letters)
 * @param showFrame - Whether to show the gold rectangular frame
 */
export function LogoRMK({ 
  scale = 1, 
  variant = 'light',
  showFrame = true 
}: { 
  scale?: number; 
  variant?: 'dark' | 'light';
  showFrame?: boolean;
}) {
  const w = 140 * scale;
  const h = 80 * scale;
  const letterColor = variant === 'dark' ? '#FFFFFF' : '#0A0A0A';
  const goldColor = '#C9A84C';
  const conseilsColor = variant === 'dark' ? 'rgba(255,255,255,0.7)' : '#3A3A3A';

  return (
    <svg 
      width={w} 
      height={h} 
      viewBox="0 0 140 80" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="RMK Conseils"
    >
      {/* Gold rectangular frame — offset right & slightly down */}
      {showFrame && (
        <rect 
          x="52" y="12" 
          width="84" height="62" 
          rx="0" 
          stroke={goldColor} 
          strokeWidth="1.5" 
          fill="none" 
        />
      )}

      {/* R — Serif capital with distinctive leg */}
      <path 
        d="M12 16 L12 64 L16 64 L16 44 L28 44 L38 64 L43 64 L32 43.5 C37 42 40 38 40 33 C40 25 34 20 25 20 L12 20 Z M16 24 L24 24 C32 24 36 27 36 33 C36 39 32 42 24 42 L16 42 Z"
        fill={letterColor}
      />

      {/* M — Tall serif M with diagonal strokes */}
      <path 
        d="M48 20 L48 64 L52 64 L52 28 L64 54 L66 54 L78 28 L78 64 L82 64 L82 20 L78 20 L65 48 L52 20 Z"
        fill={letterColor}
      />

      {/* K — Serif K with elegant diagonal strokes extending beyond frame */}
      <path 
        d="M90 20 L90 64 L94 64 L94 44 L96 42 L114 64 L119 64 L98 40 L117 20 L112 20 L94 40 L94 20 Z"
        fill={letterColor}
      />

      {/* CONSEILS — Elegant wide-tracked small caps */}
      <text 
        x="56" 
        y="50" 
        fontFamily="'Cormorant Garamond', 'Times New Roman', serif" 
        fontSize="7.5" 
        fontWeight="500"
        letterSpacing="3.5"
        fill={conseilsColor}
      >
        CONSEILS
      </text>
    </svg>
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
  const letterColor = variant === 'dark' ? '#FFFFFF' : '#0A0A0A';
  const goldColor = '#C9A84C';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 * scale }}>
      <svg 
        width={42 * scale} 
        height={28 * scale} 
        viewBox="0 0 42 28" 
        fill="none"
        role="img"
        aria-label="RMK"
      >
        {/* Small gold frame accent */}
        <rect x="24" y="3" width="16" height="22" stroke={goldColor} strokeWidth="1" fill="none" />
        
        {/* R */}
        <path d="M2 4 L2 24 L4.5 24 L4.5 15.5 L9 15.5 L13 24 L15.5 24 L11 15 C13 14.5 14.5 12.5 14.5 10.5 C14.5 7 12 5 8.5 5 L2 5 Z M4.5 7 L8 7 C11 7 12.5 8.5 12.5 10.5 C12.5 12.5 11 14 8 14 L4.5 14 Z" fill={letterColor} />
        
        {/* M */}
        <path d="M17 5 L17 24 L19 24 L19 9 L23.5 20 L24.5 20 L29 9 L29 24 L31 24 L31 5 L28.5 5 L24 17 L19.5 5 Z" fill={letterColor} />
        
        {/* K */}
        <path d="M33 5 L33 24 L35 24 L35 15 L36 14 L42 24 L44.5 24 L37.5 13.5 L44 5 L41.5 5 L35 13.5 L35 5 Z" fill={letterColor} />
      </svg>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        lineHeight: 1,
      }}>
        <span style={{ 
          fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
          fontSize: 15 * scale, 
          fontWeight: 700, 
          color: letterColor, 
          letterSpacing: 1 
        }}>
          RMK
        </span>
        <span style={{ 
          fontSize: 6.5 * scale, 
          fontWeight: 600, 
          color: goldColor, 
          letterSpacing: 3, 
          textTransform: 'uppercase' as const 
        }}>
          Conseils
        </span>
      </div>
    </div>
  );
}
