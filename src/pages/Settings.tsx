import { useEffect, useState } from 'react';
import { db, exportBackup, importBackup, saveSettings } from '../db';
import { tradePnl } from '../calc';
import { parseNum, useSettings } from '../format';
import { toast } from '../components/ui';
import Icon from '../components/Icon';
import { FUTURES_PRESETS, deleteInstrument, saveInstrument, useInstruments, type Instrument } from '../instruments';
import { CATEGORIES, categoryOf, type Category } from '../catalog';

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function SettingsPage() {
  const settings = useSettings();
  const [currency, setCurrency] = useState(settings.currency);
  const [fees, setFees] = useState(String(settings.defaultFees));
  const [feePct, setFeePct] = useState(String(settings.defaultFeePct));
  const [mult, setMult] = useState(String(settings.defaultMultiplier));
  const [msg, setMsg] = useState('');
  const [usage, setUsage] = useState('');
  useEffect(() => { if (msg) { toast(msg); setMsg(''); } }, [msg]);

  useEffect(() => {
    setCurrency(settings.currency);
    setFees(String(settings.defaultFees));
    setFeePct(String(settings.defaultFeePct));
    setMult(String(settings.defaultMultiplier));
  }, [settings.currency, settings.defaultFees, settings.defaultFeePct, settings.defaultMultiplier]);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1e6).toFixed(1).replace('.', ',')} Mo utilisés`);
    });
  }, []);

  async function save() {
    await saveSettings({ currency: currency.trim() || '€', defaultFees: parseNum(fees) ?? 0, defaultFeePct: parseNum(feePct) ?? 0, defaultMultiplier: parseNum(mult) ?? 1 });
    setMsg('Réglages enregistrés.');
  }

  async function doExport() {
    download(await exportBackup(), `trad-journal-${new Date().toISOString().slice(0, 10)}.json`);
    setMsg('Sauvegarde téléchargée.');
  }

  async function doCsv() {
    const trades = await db.trades.orderBy('date').toArray();
    const cols = ['date', 'time', 'symbol', 'side', 'qty', 'entry', 'exit', 'stop', 'target', 'fees', 'feePct', 'multiplier', 'pnl', 'setup', 'followedPlan', 'rating', 'emotions', 'mistakes', 'reasonEntry', 'reasonExit', 'notes'];
    const lines = trades.map((t) => cols.map((c) => {
      if (c === 'pnl') return csvCell(tradePnl(t)?.toFixed(2));
      const v = (t as unknown as Record<string, unknown>)[c];
      return csvCell(Array.isArray(v) ? v.join(', ') : v);
    }).join(';'));
    download(new Blob(['﻿' + [cols.join(';'), ...lines].join('\n')], { type: 'text/csv' }), 'trades.csv');
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const replace = confirm('Remplacer toutes les données actuelles par cette sauvegarde ?\n\nOK = remplacer · Annuler = fusionner');
    try {
      const r = await importBackup(file, replace ? 'replace' : 'merge');
      setMsg(`Import terminé : ${r.trades} trades, ${r.lessons} leçons, ${r.images} images.`);
    } catch (err) {
      setMsg(`Échec de l’import : ${(err as Error).message}`);
    }
  }

  async function wipe() {
    if (!confirm('Effacer TOUS les trades, images et leçons de cet appareil ?')) return;
    if (!confirm('Vraiment ? Cette action est définitive (pense à exporter avant).')) return;
    await Promise.all([db.trades.clear(), db.images.clear(), db.lessons.clear()]);
    setMsg('Données effacées.');
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <span className="eyebrow">Réglages</span>
          <h1>Ton <span className="grad-text">poste de travail.</span></h1>
        </div>
      </header>
      <section className="card">
        <h2><Icon name="settings" size={17} /> Préférences</h2>
        <div className="fields">
          <label className="field"><span>Devise</span><input value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
          <label className="field"><span>Frais fixes par trade</span><input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} /></label>
          <label className="field"><span>Frais en % (entrée + sortie)</span><input inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} placeholder="ex. 0,1" /></label>
          <label className="field"><span>Valeur du point par défaut</span><input inputMode="decimal" value={mult} onChange={(e) => setMult(e.target.value)} /></label>
        </div>
        <p className="muted small">Valeur du point : 1 pour les actions et la crypto. Pour un future (ex. 5 € par point sur le mini-DAX), indique 5. Frais en % : appliqués au montant échangé à l’entrée et à la sortie (ex. 0,1 % sur Binance en taker). Le P&amp;L = (sortie − entrée) × quantité × valeur du point − frais.</p>
        <button className="btn primary" onClick={save}>Enregistrer</button>
      </section>

      <InstrumentsSection currency={settings.currency} />

      <section className="card">
        <h2><Icon name="download" size={17} /> Sauvegarde</h2>
        <p className="muted small">Tes données restent sur cet appareil{usage ? ` (${usage})` : ''}. Exporte régulièrement une sauvegarde : elle contient aussi les captures.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={doExport}>Exporter la sauvegarde (.json)</button>
          <label className="btn">Importer une sauvegarde<input type="file" accept="application/json,.json" hidden onChange={doImport} /></label>
          <button className="btn" onClick={doCsv}>Exporter en CSV (Excel)</button>
        </div>
      </section>

      <section className="card">
        <h2><Icon name="trash" size={17} /> Zone dangereuse</h2>
        <button className="btn danger" onClick={wipe}>Effacer toutes les données</button>
      </section>

    </div>
  );
}

function InstrumentsSection({ currency }: { currency: string }) {
  const instruments = useInstruments();
  const [sym, setSym] = useState('');
  const [mult, setMult] = useState('');
  const rows = Object.entries(instruments).sort(([a], [b]) => a.localeCompare(b));

  async function add() {
    const m = parseNum(mult);
    if (!sym.trim() || m == null || m <= 0) return;
    await saveInstrument(sym, { multiplier: m });
    setSym(''); setMult('');
  }

  return (
    <section className="card">
      <h2><Icon name="target" size={17} /> Instruments</h2>
      <p className="muted small">
        Valeur du point et frais retenus par symbole, appliqués automatiquement à la saisie.
        Actions et crypto : rien à faire (valeur du point = 1). Futures : ajoute tes contrats ci-dessous.
        La valeur du point se modifie aussi depuis le détail d’un trade, et l’appli la retient pour ce symbole.
      </p>
      {rows.length > 0 && (
        <div className="table-scroll">
          <table className="instruments">
            <thead><tr><th>Symbole</th><th>Catégorie</th><th>Valeur du point</th><th>Frais fixes ({currency})</th><th>Frais %</th><th /></tr></thead>
            <tbody>
              {rows.map(([s, i]) => <InstrumentRow key={s} symbol={s} inst={i} />)}
            </tbody>
          </table>
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <input value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} placeholder="Symbole (ex. MNQ)" />
        <input value={mult} onChange={(e) => setMult(e.target.value)} inputMode="decimal" placeholder="Valeur du point" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn" onClick={add}>Ajouter</button>
      </div>
      <h3>Futures courants</h3>
      <div className="presets">
        {FUTURES_PRESETS.map((p) => (
          <button key={p.symbol} className={instruments[p.symbol] ? 'chip on' : 'chip'} title={`${p.label} : ${p.multiplier} ${p.currency} par point`}
            onClick={() => instruments[p.symbol] ? deleteInstrument(p.symbol) : saveInstrument(p.symbol, { multiplier: p.multiplier, label: p.label, category: 'futures' })}>
            {p.symbol} <span className="muted">×{String(p.multiplier).replace('.', ',')} {p.currency}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        Clique pour ajouter ou retirer. Attention : les contrats US sont en dollars. Si ta devise est l’euro,
        le P&amp;L de ces trades sera exprimé en dollars, sans conversion.
      </p>
    </section>
  );
}

function InstrumentRow({ symbol, inst }: { symbol: string; inst: Instrument }) {
  const num = (k: 'multiplier' | 'fees' | 'feePct') => ({
    defaultValue: inst[k] == null ? '' : String(inst[k]).replace('.', ','),
    inputMode: 'decimal' as const,
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const v = parseNum(e.target.value);
      if (k === 'multiplier' && (v == null || v <= 0)) return;
      void saveInstrument(symbol, { [k]: v ?? undefined });
    },
  });
  return (
    <tr>
      <td title={inst.label}>{symbol}</td>
      <td>
        <select value={inst.category ?? categoryOf(symbol)} aria-label={`Catégorie ${symbol}`}
          onChange={(e) => void saveInstrument(symbol, { category: e.target.value as Category })}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </td>
      <td><input {...num('multiplier')} aria-label={`Valeur du point ${symbol}`} /></td>
      <td><input {...num('fees')} placeholder="—" aria-label={`Frais fixes ${symbol}`} /></td>
      <td><input {...num('feePct')} placeholder="—" aria-label={`Frais % ${symbol}`} /></td>
      <td><button className="btn ghost small" onClick={() => deleteInstrument(symbol)} aria-label={`Retirer ${symbol}`}>✕</button></td>
    </tr>
  );
}
