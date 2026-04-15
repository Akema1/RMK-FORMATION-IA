// ─────────────────────────────────────────────
// CLIENT PORTAL — Design tokens & shared types
// ─────────────────────────────────────────────
import type React from 'react';

export const NAVY = '#1B2A4A';
export const GOLD = '#C9A84C';
export const GOLD_DARK = '#A88A3D';
export const SURFACE = '#F5F0E8';
export const WHITE = '#FFFFFF';
export const RED = '#E74C3C';
export const GREEN = '#27AE60';

export type PortalSection = 'dashboard' | 'programme' | 'coaching' | 'community' | 'discovery' | 'profile';

export interface OnboardingProfile {
  name: string;
  email: string;
  company: string;
  fonction: string;
}

export interface SurveyAnswer {
  secteur: string;
  collaborateurs: string;
  aiUsage: string;
  defi: string;
  attentes: string[];
  source: string;
}

export interface CommunityPost {
  id: string;
  author: string;
  initials: string;
  date: string;
  text: string;
  seminarTag: string;
}

export interface FormationModule {
  title: string;
  points: string[];
}

export interface FormationContent {
  subtitle: string;
  public_cible: string;
  methodology: string[];
  modules: FormationModule[];
  cas_pratiques: string[];
  resultats: string[];
  formateur: { name: string; title: string; company: string; citation: string };
}

// Shared inline style bases
export const cardBase: React.CSSProperties = {
  background: WHITE,
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 16,
  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
};

export function goldButton(disabled = false): React.CSSProperties {
  return {
    padding: '14px 28px',
    borderRadius: 12,
    border: 'none',
    background: disabled ? 'rgba(201,168,76,0.4)' : `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
    color: WHITE,
    fontSize: 15,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s',
  };
}

export function navyButton(): React.CSSProperties {
  return {
    padding: '14px 28px',
    borderRadius: 12,
    border: `1px solid ${NAVY}`,
    background: NAVY,
    color: WHITE,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s',
  };
}

// Shared helpers
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
