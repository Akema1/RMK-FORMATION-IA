import React from 'react';
import { fmt } from '../data/seminars';
import { card, inputS, label, ORANGE, ICON_EMOJI } from './config';
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

  const totalSeats = seminars.reduce((s, x) => s + x.seats, 0);
  const projectedRevenue = totalSeats * prices.standard;

  return (
    <div>
      <h2 style={{ color: "#1B2A4A", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Gestion des tarifs</h2>
      <p style={{ color: '#1B2A4A', fontSize: 14, margin: "0 0 24px" }}>Ajustez les prix en temps réel. Les modifications s'appliquent immédiatement au tableau de bord et aux projections financières.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left column: Pricing */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Standard & Dirigeants */}
          <div style={card}>
            <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Tarifs par programme</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={label}>Tarif standard (S2, S3, S4)</label>
                <input type="number" style={inputS} value={prices.standard} onChange={upd("standard")} />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Prix par personne / séminaire</div>
              </div>
              <div>
                <label style={label}>Tarif Dirigeants (S1)</label>
                <input type="number" style={inputS} value={prices.dirigeants} onChange={upd("dirigeants")} />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>S1 uniquement (coaching inclus)</div>
              </div>
            </div>
            {/* Per-seminar price summary */}
            <div style={{ marginTop: 16, padding: 12, background: "rgba(0,0,0,0.03)", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Récapitulatif</div>
              {seminars.map(s => {
                const isS1 = s.code === "S1";
                const price = isS1 ? prices.dirigeants : prices.standard;
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <span style={{ fontSize: 13, color: "#1B2A4A" }}>{ICON_EMOJI[s.icon] || "📋"} {s.code} — {s.title}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isS1 ? ORANGE : "#1B2A4A" }}>{fmt(price)} F</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Early Bird */}
          <div style={card}>
            <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Early Bird</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={label}>Remise Early Bird (%)</label>
                <input type="number" style={inputS} value={prices.discountPct} onChange={upd("discountPct")} />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Ex: 10 pour 10%</div>
              </div>
              <div>
                <label style={label}>Tarif early bird calculé</label>
                <input type="number" style={{ ...inputS, background: "rgba(0,0,0,0.03)", color: "#64748B" }} value={prices.earlyBird} disabled />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Calculé automatiquement</div>
              </div>
            </div>
          </div>

          {/* Coaching */}
          <div style={card}>
            <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Coaching personnalisé</h3>
            <div>
              <label style={label}>Prix session coaching (2h)</label>
              <input type="number" style={inputS} value={prices.coaching} onChange={upd("coaching")} />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Inclus pour les dirigeants (S1), optionnel pour les autres</div>
            </div>
          </div>
        </div>

        {/* Right column: Packs & Projections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Pack Entreprise Discounts */}
          <div style={card}>
            <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Pack Entreprise — Remises</h3>
            {[
              { key: "packDiscount3", label: "Remise 3+ inscrits même entreprise (%)", desc: "Ex: 15 pour 15%" },
              { key: "packDiscount2sem", label: "Remise Pack 2 séminaires (%)", desc: "Ex: 10 pour 10%" },
              { key: "packDiscount4sem", label: "Remise Pack 4 séminaires (%)", desc: "Ex: 20 pour 20%" },
            ].map(p => (
              <div key={p.key} style={{ marginBottom: 16 }}>
                <label style={label}>{p.label}</label>
                <input type="number" style={inputS} value={prices[p.key as keyof Prices]} onChange={upd(p.key)} />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{p.desc}</div>
              </div>
            ))}
          </div>

          {/* Rémunération */}
          <div style={card}>
            <h3 style={{ color: "#1B2A4A", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Rémunération & Budget</h3>
            <div style={{ padding: 16, background: "rgba(201,168,76,0.08)", borderRadius: 10, border: `1px solid ${ORANGE}33` }}>
              <div style={{ color: ORANGE, fontSize: 13, fontWeight: 700 }}>Honoraires CABEXIA (Fixes)</div>
              <div style={{ color: '#1B2A4A', fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>
                Consultance présentiel : <strong style={{ color: "#1B2A4A" }}>1 050 000 FCFA</strong> / séminaire<br />
                Consultance en ligne : <strong style={{ color: "#1B2A4A" }}>400 000 FCFA</strong> / séminaire<br />
                Total CABEXIA : <strong style={{ color: "#1B2A4A" }}>1 450 000 FCFA</strong> / séminaire
              </div>
            </div>
            <div style={{ marginTop: 16, padding: 16, background: "rgba(39,174,96,0.08)", borderRadius: 10 }}>
              <div style={{ color: "#27AE60", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Projection CA (objectif rempli)</div>
              <div style={{ color: "#1B2A4A", fontSize: 20, fontWeight: 800 }}>{fmt(projectedRevenue)} FCFA</div>
              <div style={{ color: '#1B2A4A', fontSize: 11, marginTop: 4 }}>{totalSeats} participants × {fmt(prices.standard)} FCFA</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
