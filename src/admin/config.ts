import React from 'react';
import { SEMINARS as BASE_SEMINARS } from '../data/seminars';
import type { Seminar, BudgetConfig, Prices, TeamMember } from './types';

// ─── DEFAULT DATA ───
export const DEFAULT_SEMINARS: Seminar[] = BASE_SEMINARS.map(s => ({
  ...s,
  flyer_subtitle: s.subtitle,
  flyer_highlight: s.highlights[0] || "",
  flyer_bullets: s.highlights.slice(0, 3),
  flyer_image: "",
}));

export const DEFAULT_PRICES: Prices = { standard: 600000, earlyBird: 540000, discountPct: 10 };

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  consultance_pres: 1050000,
  consultance_ligne: 400000,
  billet_avion: 650000,
  sejour: 480000,
  salle: 450000,
  pauses_cafe: 450000,
  dejeuner: 675000,
  supports: 75000,
  equipements: 150000,
  divers: 100000,
  transport: 150000,
  commercialisation_pct: 0.1
};

export const TEAM: TeamMember[] = [
  { id: "alexis", name: "Alexis", role: "Formateur CABEXIA + Stratégie RMK", avatar: "AD" },
  { id: "rosine", name: "Rosine", role: "Opérations & Commercial RMK", avatar: "RM" },
];

export const EXPENSE_CATEGORIES = [
  { value: "consultance_pres", label: "Consultance (Présentiel)" },
  { value: "consultance_ligne", label: "Consultance (En Ligne)" },
  { value: "billet_avion", label: "Billet d'avion" },
  { value: "sejour", label: "Hébergement / Séjour" },
  { value: "salle", label: "Location Salle" },
  { value: "pauses_cafe", label: "Pauses Café" },
  { value: "dejeuner", label: "Déjeuners" },
  { value: "supports", label: "Supports Pédagogiques" },
  { value: "equipements", label: "Équipements" },
  { value: "commercialisation", label: "Communication / Mkt" },
  { value: "transport", label: "Transport local" },
  { value: "divers", label: "Divers & Imprévus" }
] as const;

// ─── COLORS ───
export const SURFACE_BG = "#FAF9F6";
export const ORANGE = "#C9A84C";

// ─── SHARED STYLES ───
export const card: React.CSSProperties = {
  background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  padding: 24,
};

export const inputS: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "rgba(0,0,0,0.06)",
  color: "#1B2A4A",
  outline: "none",
  boxSizing: "border-box",
};

export const selectS: React.CSSProperties = { ...inputS, cursor: "pointer" };

export const btnPrimary: React.CSSProperties = {
  background: `linear-gradient(135deg,${ORANGE},#A88A3D)`,
  color: "#fff",
  border: "none",
  padding: "12px 24px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.2s",
};

export const btnSecondary: React.CSSProperties = {
  background: "rgba(0,0,0,0.06)",
  color: "#1B2A4A",
  border: "1px solid rgba(0,0,0,0.12)",
  padding: "10px 20px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

export const badge = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 100,
  fontSize: 11,
  fontWeight: 700,
  background: `${color}22`,
  color,
});

export const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#1B2A4A',
  display: "block",
  marginBottom: 6,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};
