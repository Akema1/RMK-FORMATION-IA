import React from 'react';
import { fmt } from '../data/seminars';
import { card, inputS, label, ORANGE } from './config';
import type { Seminar, Prices } from './types';

interface PricesPageProps {
  prices: Prices;
  seminars: Seminar[];
  setPrices: (prices: Prices) => void;
}

export function PricesPage({ prices, seminars, setPrices }: PricesPageProps) {
  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (k === 'discountPct') {
      setPrices({ ...prices, discountPct: val, earlyBird: prices.standard * (1 - val / 100) });
    } else if (k === 'standard') {
      setPrices({ ...prices, standard: val, earlyBird: val * (1 - prices.discountPct / 100) });
    } else {
      setPrices({ ...prices, [k]: val });
    }
  };

  return (
    <div>
      <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Gestion des tarifs</h2>
      <p style={{ color: '#1B2A4A', fontSize: 14, margin: "0 0 24px" }}>Ajustez les prix en temps réel. Les modifications s'appliquent immédiatement au tableau de bord et aux projections financières.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={card}>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Tarifs individuels</h3>
          {[
            { key: "standard", label: "Tarif standard (5 jours hybride)", desc: "Prix plein par personne", disabled: false },
            { key: "discountPct", label: "Pourcentage de remise Early Bird (%)", desc: "Ex: 10 pour 10%", disabled: false },
            { key: "earlyBird", label: "Tarif early bird calculé", desc: "Calculé automatiquement", disabled: true },
          ].map(p => (
            <div key={p.key} style={{ marginBottom: 16 }}>
              <label style={label}>{p.label}</label>
              <input type="number" style={inputS} value={prices[p.key as keyof Prices]} onChange={upd(p.key)} disabled={p.disabled} />
              <div style={{ fontSize: 11, color: '#1B2A4A', marginTop: 4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <div style={card}>
          <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Rémunération & Budget</h3>
          <div style={{ marginTop: 8, padding: 16, background: "rgba(201,168,76,0.08)", borderRadius: 10, border: `1px solid ${ORANGE}33` }}>
            <div style={{ color: ORANGE, fontSize: 13, fontWeight: 700 }}>Honoraires CABEXIA (Fixes)</div>
            <div style={{ color: '#1B2A4A', fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>
              Consultance présentiel : <strong style={{ color: "#1B2A4A" }}>1 050 000 FCFA</strong> / séminaire<br />
              Consultance en ligne : <strong style={{ color: "#1B2A4A" }}>400 000 FCFA</strong> / séminaire<br />
              Total CABEXIA : <strong style={{ color: "#1B2A4A" }}>1 450 000 FCFA</strong> / séminaire
            </div>
          </div>
          <div style={{ marginTop: 16, padding: 16, background: "rgba(39,174,96,0.08)", borderRadius: 10 }}>
            <div style={{ color: "#27AE60", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Projection CA (objectif rempli)</div>
            <div style={{ color: "#1B2A4A", fontSize: 20, fontWeight: 800 }}>{fmt(seminars.reduce((s, x) => s + x.seats, 0) * prices.standard)} FCFA</div>
            <div style={{ color: '#1B2A4A', fontSize: 11, marginTop: 4 }}>{seminars.reduce((s, x) => s + x.seats, 0)} participants × {fmt(prices.standard)} FCFA</div>
          </div>
        </div>
      </div>
    </div>
  );
}
