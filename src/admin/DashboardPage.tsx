import React from 'react';
import { fmt } from '../data/seminars';
import { card, badge, ORANGE, ICON_EMOJI } from './config';
import type { Seminar, Participant, Task, Lead, Prices } from './types';

interface DashboardPageProps {
  participants: Participant[];
  prices: Prices;
  tasks: Task[];
  leads: Lead[];
  seminars: Seminar[];
}

export function DashboardPage({ participants, prices, tasks, leads, seminars }: DashboardPageProps) {
  const confirmed = participants.filter(p => p.status === "confirmed");
  const totalRev = confirmed.reduce((s, p) => s + (p.amount || 0), 0);
  const totalSeats = seminars.reduce((s, x) => s + x.seats, 0);
  const target = totalSeats * prices.standard;

  const pendingTasks = tasks?.filter(t => t.status !== "done") || [];
  const hotLeads = leads?.filter(l => l.status === "chaud") || [];

  return (
    <div>
      <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 24px" }}>Tableau de bord complet</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Inscrits", val: participants.length, sub: `/ ${totalSeats} places`, color: ORANGE, pct: participants.length / totalSeats * 100 },
          { label: "Confirmés", val: confirmed.length, sub: `/ ${participants.length} inscrits`, color: "#27AE60", pct: participants.length ? confirmed.length / participants.length * 100 : 0 },
          { label: "Revenus encaissés", val: `${(totalRev / 1e6).toFixed(1)}M`, sub: `obj. ${(target / 1e6).toFixed(0)}M FCFA`, color: "#2980B9", pct: totalRev / target * 100 },
          { label: "Taux remplissage", val: `${Math.round(participants.length / totalSeats * 100)}%`, sub: "objectif 85%", color: "#F39C12", pct: participants.length / totalSeats * 100 },
          { label: "Leads Chauds", val: hotLeads.length, sub: `/ ${leads?.length || 0} prospects`, color: "#E74C3C", pct: leads?.length ? hotLeads.length / leads.length * 100 : 0 },
          { label: "Tâches en cours", val: pendingTasks.length, sub: `/ ${tasks?.length || 0} total`, color: "#8E44AD", pct: tasks?.length ? (tasks.length - pendingTasks.length) / tasks.length * 100 : 0 },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 11, color: '#1B2A4A', letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1B2A4A" }}>{k.val} <span style={{ fontSize: 12, fontWeight: 400, color: '#1B2A4A' }}>{k.sub}</span></div>
            <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.08)" }}>
              <div style={{ height: "100%", borderRadius: 2, background: k.color, width: `${Math.min(k.pct, 100)}%`, transition: "width 0.8s" }} />
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Par séminaire</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        {seminars.map(s => {
          const sp = participants.filter(p => p.seminar === s.id);
          const sc = sp.filter(p => p.status === "confirmed");
          return (
            <div key={s.id} style={{ ...card, borderTop: `3px solid ${s.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{ICON_EMOJI[s.icon] || "📋"}</span>
                <span style={badge(s.color)}>{s.code}</span>
              </div>
              <div style={{ color: "#1B2A4A", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{s.title}</div>
              <div style={{ color: '#1B2A4A', fontSize: 12, marginBottom: 12 }}>{s.week}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><div style={{ fontSize: 20, fontWeight: 800, color: "#1B2A4A" }}>{sp.length}<span style={{ fontSize: 11, color: '#1B2A4A' }}>/{s.seats}</span></div><div style={{ fontSize: 10, color: '#1B2A4A' }}>Inscrits</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 800, color: "#27AE60" }}>{sc.length}</div><div style={{ fontSize: 10, color: '#1B2A4A' }}>Confirmés</div></div>
              </div>
              <div style={{ marginTop: 12, height: 5, borderRadius: 3, background: "rgba(0,0,0,0.08)" }}>
                <div style={{ height: "100%", borderRadius: 3, background: s.color, width: `${(sp.length / s.seats) * 100}%` }} />
              </div>
              <div style={{ fontSize: 11, color: '#1B2A4A', marginTop: 6 }}>{fmt(sc.reduce((a, p) => a + (p.amount || 0), 0))} FCFA encaissé</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
