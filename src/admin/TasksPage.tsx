import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { card, inputS, selectS, btnPrimary, badge, label, TEAM } from './config';
import type { Seminar, Task } from './types';

interface TasksPageProps {
  tasks: Task[];
  seminars: Seminar[];
  refreshTasks: () => Promise<void>;
}

const statusColors: Record<string, string> = { todo: "#94A3B8", progress: "#F39C12", done: "#27AE60" };
const statusLabels: Record<string, string> = { todo: "À faire", progress: "En cours", done: "Terminé" };
const priorityColors: Record<string, string> = { high: "#E74C3C", medium: "#F39C12", low: "#27AE60" };

export function TasksPage({ tasks, seminars, refreshTasks }: TasksPageProps) {
  const [newTask, setNewTask] = useState({ task: "", owner: "alexis", deadline: "", seminar: "all", priority: "medium" });

  const addTask = async () => {
    if (!newTask.task) return;
    await supabase.from('tasks').insert([{ ...newTask, status: "todo" }]);
    refreshTasks();
    setNewTask({ task: "", owner: "alexis", deadline: "", seminar: "all", priority: "medium" });
  };

  const cycle = async (id: string, currentStatus: string) => {
    const order = ["todo", "progress", "done"];
    const nextStatus = order[(order.indexOf(currentStatus) + 1) % 3];
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', id);
    refreshTasks();
  };

  const deleteTask = async (id: string) => {
    if (window.confirm("Supprimer définitivement ?")) {
      await supabase.from('tasks').delete().eq('id', id);
      refreshTasks();
    }
  };

  return (
    <div>
      <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 24px" }}>Gestion des tâches</h2>
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div><label style={label}>Tâche *</label><input style={inputS} value={newTask.task} onChange={e => setNewTask({ ...newTask, task: e.target.value })} placeholder="Description..." /></div>
          <div><label style={label}>Responsable</label>
            <select style={selectS} value={newTask.owner} onChange={e => setNewTask({ ...newTask, owner: e.target.value })}>
              {TEAM.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><label style={label}>Deadline</label><input type="date" style={inputS} value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} /></div>
          <div><label style={label}>Priorité</label>
            <select style={selectS} value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
          </div>
          <div><label style={label}>Atelier</label>
            <select style={selectS} value={newTask.seminar} onChange={e => setNewTask({ ...newTask, seminar: e.target.value })}>
              <option value="all">Général</option>
              {seminars.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </div>
          <button onClick={addTask} style={{ ...btnPrimary, height: 42 }}>+</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {(["todo", "progress", "done"] as const).map(status => (
          <div key={status}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColors[status] }} />
              <span style={{ color: "#1B2A4A", fontSize: 14, fontWeight: 700 }}>{statusLabels[status]}</span>
              <span style={{ color: '#1B2A4A', fontSize: 12 }}>({tasks.filter(t => t.status === status).length})</span>
            </div>
            {tasks.filter(t => t.status === status).map(t => (
              <div key={t.id} style={{ ...card, marginBottom: 8, borderLeft: `3px solid ${statusColors[status]}`, padding: 16, transition: "all 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div onClick={() => cycle(t.id, t.status)} style={{ color: "#1B2A4A", fontSize: 13, fontWeight: 600, flex: 1, cursor: "pointer" }}>{t.task}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...badge(priorityColors[t.priority]), fontSize: 9, flexShrink: 0 }}>{t.priority}</span>
                    <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", color: "#E74C3C", cursor: "pointer", fontSize: 14 }}>🗑</button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: '#1B2A4A' }}>
                  <span>{TEAM.find(m => m.id === t.owner)?.avatar} {TEAM.find(m => m.id === t.owner)?.name}</span>
                  {t.deadline && <span>{t.deadline}</span>}
                  {t.seminar !== "all" && <span style={{ color: seminars.find(s => s.id === t.seminar)?.color }}>{seminars.find(s => s.id === t.seminar)?.code}</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
