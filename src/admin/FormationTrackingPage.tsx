import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { card, inputS, selectS, btnPrimary, btnSecondary, label, ORANGE, ICON_EMOJI } from './config';
import type { Seminar, Participant } from './types';

interface FormationTrackingPageProps {
  seminars: Seminar[];
  participants: Participant[];
}

interface SessionRecord {
  id: string;
  seminarId: string;
  day: number;
  date: string;
  type: 'presentiel' | 'en_ligne';
  topic: string;
  status: 'planifie' | 'en_cours' | 'termine';
  notes: string;
  attendance: string[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  planifie: { bg: "rgba(41,128,185,0.1)", text: "#2980B9", label: "Planifié" },
  en_cours: { bg: "rgba(243,156,18,0.1)", text: "#E67E22", label: "En cours" },
  termine: { bg: "rgba(39,174,96,0.1)", text: "#27AE60", label: "Terminé" },
};

export function FormationTrackingPage({ seminars, participants }: FormationTrackingPageProps) {
  const [selectedSem, setSelectedSem] = useState(seminars[0]?.id || "");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<SessionRecord>>({
    day: 1, type: 'presentiel', topic: '', status: 'planifie', notes: '', date: '', attendance: [],
  });

  const sem = seminars.find(s => s.id === selectedSem);
  const semParticipants = participants.filter(p => p.seminar === selectedSem && p.status === 'confirmed');
  const semSessions = sessions.filter(s => s.seminarId === selectedSem).sort((a, b) => a.day - b.day);

  const completedSessions = semSessions.filter(s => s.status === 'termine').length;
  const totalSessions = semSessions.length;
  const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const addSession = () => {
    if (!form.topic || !form.date) return;
    const newSession: SessionRecord = {
      id: crypto.randomUUID(),
      seminarId: selectedSem,
      day: Number(form.day) || 1,
      date: form.date || '',
      type: form.type || 'presentiel',
      topic: form.topic || '',
      status: form.status || 'planifie',
      notes: form.notes || '',
      attendance: [],
    };
    setSessions([...sessions, newSession]);
    setForm({ day: (Number(form.day) || 1) + 1, type: 'presentiel', topic: '', status: 'planifie', notes: '', date: '', attendance: [] });
    setShowForm(false);
  };

  const updateStatus = (id: string, status: SessionRecord['status']) => {
    setSessions(sessions.map(s => s.id === id ? { ...s, status } : s));
  };

  const deleteSession = (id: string) => {
    if (confirm("Supprimer cette session ?")) {
      setSessions(sessions.filter(s => s.id !== id));
    }
  };

  const generateDefaultSessions = () => {
    if (!sem) return;
    const baseDate = sem.dates?.start ? new Date(sem.dates.start) : new Date();
    const defaults: SessionRecord[] = [
      { id: crypto.randomUUID(), seminarId: selectedSem, day: 1, date: baseDate.toISOString().split('T')[0], type: 'presentiel', topic: `Module commun : Introduction à l'IA`, status: 'planifie', notes: 'Matinée : intro IA commune. Après-midi : début du programme spécifique.', attendance: [] },
      { id: crypto.randomUUID(), seminarId: selectedSem, day: 2, date: new Date(baseDate.getTime() + 86400000).toISOString().split('T')[0], type: 'presentiel', topic: `${sem.title} — Ateliers pratiques`, status: 'planifie', notes: 'Études de cas et exercices hands-on.', attendance: [] },
      { id: crypto.randomUUID(), seminarId: selectedSem, day: 3, date: new Date(baseDate.getTime() + 2 * 86400000).toISOString().split('T')[0], type: 'presentiel', topic: `${sem.title} — Cas avancés & synthèse présentiel`, status: 'planifie', notes: 'Dernière journée présentiel.', attendance: [] },
      { id: crypto.randomUUID(), seminarId: selectedSem, day: 4, date: new Date(baseDate.getTime() + 7 * 86400000).toISOString().split('T')[0], type: 'en_ligne', topic: `Session Zoom — Retour d'expérience`, status: 'planifie', notes: '9h–13h. Approfondissement, questions.', attendance: [] },
      { id: crypto.randomUUID(), seminarId: selectedSem, day: 5, date: new Date(baseDate.getTime() + 8 * 86400000).toISOString().split('T')[0], type: 'en_ligne', topic: `Session Zoom — Feuille de route personnelle`, status: 'planifie', notes: '9h–13h. Plan d\'action individuel, clôture.', attendance: [] },
    ];
    setSessions([...sessions.filter(s => s.seminarId !== selectedSem), ...defaults]);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>Suivi de Formation</h2>
          <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>Planifiez les sessions, suivez l'avancement et la présence par séminaire.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select style={{ ...selectS, width: 260 }} value={selectedSem} onChange={e => setSelectedSem(e.target.value)}>
            {seminars.map(s => <option key={s.id} value={s.id}>{ICON_EMOJI[s.icon] || "📋"} {s.code} — {s.title}</option>)}
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Sessions</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1B2A4A", marginTop: 4 }}>{totalSessions}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>planifiées</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Avancement</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: progress === 100 ? "#27AE60" : ORANGE, marginTop: 4 }}>{progress}%</div>
          <div style={{ background: "rgba(0,0,0,0.08)", borderRadius: 100, height: 6, marginTop: 8 }}>
            <div style={{ background: progress === 100 ? "#27AE60" : ORANGE, borderRadius: 100, height: 6, width: `${progress}%`, transition: "width 0.5s" }} />
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Participants</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1B2A4A", marginTop: 4 }}>{semParticipants.length}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>confirmés</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Prochaine session</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1B2A4A", marginTop: 8 }}>
            {semSessions.find(s => s.status !== 'termine')?.topic || "—"}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
            {semSessions.find(s => s.status !== 'termine')?.date || ""}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button onClick={() => setShowForm(!showForm)} style={btnPrimary}>{showForm ? "✕ Fermer" : "+ Ajouter une session"}</button>
        {semSessions.length === 0 && (
          <button onClick={generateDefaultSessions} style={{ ...btnSecondary, border: `1px solid ${ORANGE}33` }}>
            Générer le planning standard (5 jours)
          </button>
        )}
      </div>

      {/* Add session form */}
      {showForm && (
        <div style={{ ...card, marginBottom: 24, borderLeft: `3px solid ${ORANGE}` }}>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nouvelle session</h3>
          <div style={{ display: "grid", gridTemplateColumns: "80px 140px 140px 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <label style={label}>Jour</label>
              <input type="number" min={1} max={10} style={inputS} value={form.day} onChange={e => setForm({ ...form, day: Number(e.target.value) })} />
            </div>
            <div>
              <label style={label}>Date</label>
              <input type="date" style={inputS} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label style={label}>Type</label>
              <select style={selectS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'presentiel' | 'en_ligne' })}>
                <option value="presentiel">Présentiel</option>
                <option value="en_ligne">En ligne (Zoom)</option>
              </select>
            </div>
            <div>
              <label style={label}>Sujet / Module</label>
              <input style={inputS} value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Ex: Introduction à l'IA Générative" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={label}>Notes</label>
            <textarea style={{ ...inputS, height: 60 }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes sur la session..." />
          </div>
          <button onClick={addSession} style={{ ...btnPrimary, marginTop: 12 }}>Enregistrer</button>
        </div>
      )}

      {/* Sessions timeline */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "60px 100px 100px 2fr 1fr 120px", padding: "12px 16px", background: "#1B2A4A", color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <div>Jour</div><div>Date</div><div>Mode</div><div>Sujet</div><div>Notes</div><div style={{ textAlign: "right" }}>Actions</div>
        </div>
        {semSessions.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
            Aucune session planifiée. Cliquez sur "Générer le planning standard" pour commencer.
          </div>
        ) : semSessions.map(s => {
          const st = STATUS_COLORS[s.status];
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "60px 100px 100px 2fr 1fr 120px", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center", transition: "background 0.2s" }}>
              <div style={{ fontWeight: 800, color: "#1B2A4A", fontSize: 16 }}>J{s.day}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{s.date}</div>
              <div>
                <span style={{ padding: "3px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: s.type === 'presentiel' ? "rgba(27,42,74,0.1)" : "rgba(201,168,76,0.15)", color: s.type === 'presentiel' ? "#1B2A4A" : ORANGE }}>
                  {s.type === 'presentiel' ? '🏢 Présentiel' : '💻 En ligne'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#1B2A4A", fontWeight: 600 }}>{s.topic}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{s.notes}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                <select
                  value={s.status}
                  onChange={e => updateStatus(s.id, e.target.value as SessionRecord['status'])}
                  style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${st.text}33`, background: st.bg, color: st.text, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <option value="planifie">Planifié</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminé</option>
                </select>
                <button onClick={() => deleteSession(s.id)} style={{ background: "none", border: "none", color: "#E74C3C", cursor: "pointer", fontSize: 14 }} title="Supprimer">🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
