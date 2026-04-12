import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, ClipboardList, Target, Wallet, CheckSquare, Tag, Bot, Search, FileImage, CalendarCheck, type LucideIcon } from 'lucide-react';
import { LogoRMK } from '../components/LogoRMK';
import { TEAM, ORANGE } from './config';

interface NavProps {
  page: string;
  setPage: (page: string) => void;
}

const tabs: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "seminaires", label: "Séminaires", Icon: GraduationCap },
  { key: "inscriptions", label: "Inscriptions", Icon: ClipboardList },
  { key: "leads", label: "Leads & Prospects", Icon: Target },
  { key: "finance", label: "Finance", Icon: Wallet },
  { key: "tasks", label: "Tâches", Icon: CheckSquare },
  { key: "prices", label: "Tarifs", Icon: Tag },
  { key: "formation", label: "Suivi Formation", Icon: CalendarCheck },
  { key: "agent", label: "Agent Commercial", Icon: Bot },
  { key: "seo", label: "Agent SEO", Icon: Search },
  { key: "flyer", label: "Flyer", Icon: FileImage },
];

export function Nav({ page, setPage }: NavProps) {
  const navigate = useNavigate();

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 220, background: "#1B2A4A", borderRight: "1px solid rgba(255,255,255,0.06)", zIndex: 20, display: "flex", flexDirection: "column", padding: "16px 0", overflowY: "auto" }}>
      <div style={{ padding: "8px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => navigate('/')}>
          <LogoRMK scale={0.4} variant="dark" />
          <div>
            <div style={{ color: "#FAF9F6", fontWeight: 700, fontSize: 14 }}>RMK CONSEILS</div>
            <div style={{ color: "rgba(250,249,246,0.6)", fontSize: 10, letterSpacing: 1 }}>ADMIN · MAI 2026</div>
          </div>
        </div>
      </div>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setPage(t.key)} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", margin: "2px 8px",
          background: page === t.key ? "rgba(201,168,76,0.15)" : "transparent",
          border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: page === t.key ? 700 : 500,
          color: page === t.key ? ORANGE : "rgba(250,249,246,0.65)", transition: "all 0.2s", textAlign: "left",
          borderLeft: page === t.key ? `3px solid ${ORANGE}` : "3px solid transparent",
        }}><t.Icon size={16} /> {t.label}</button>
      ))}
      <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {TEAM.map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <span style={{ fontSize: 11, width: 28, height: 28, borderRadius: "50%", background: "rgba(201,168,76,0.2)", color: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{m.avatar}</span>
            <div>
              <div style={{ color: "#FAF9F6", fontSize: 12, fontWeight: 600 }}>{m.name}</div>
              <div style={{ color: "rgba(250,249,246,0.5)", fontSize: 10 }}>{m.role.split("+")[0].trim()}</div>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
