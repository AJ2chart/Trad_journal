import { useEffect, useState } from 'react';
import { db, exportBackup, importBackup, saveSettings } from '../db';
import { tradePnl } from '../calc';
import { parseNum, useSettings } from '../format';

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

  useEffect(() => {
    setCurrency(settings.currency);
    setFees(String(settings.defaultFees));
    setFeePct(String(settings.defaultFeePct));
    setMult(String(settings.defaultMultiplier));
  }, [settings.currency, settings.defaultFees, settings.defaultFeePct, settings.defaultMultiplier]);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1e6).toFixed(1)} Mo utilisés`);
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
      <section className="card">
        <h2>Préférences</h2>
        <div className="fields">
          <label className="field"><span>Devise</span><input value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
          <label className="field"><span>Frais fixes par trade</span><input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} /></label>
          <label className="field"><span>Frais en % (entrée + sortie)</span><input inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} placeholder="ex. 0,1" /></label>
          <label className="field"><span>Valeur du point par défaut</span><input inputMode="decimal" value={mult} onChange={(e) => setMult(e.target.value)} /></label>
        </div>
        <p className="muted small">Valeur du point : 1 pour les actions et la crypto. Pour un future (ex. 5 € par point sur le mini-DAX), indique 5. Frais en % : appliqués au montant échangé à l’entrée et à la sortie (ex. 0,1 % sur Binance en taker). Le P&amp;L = (sortie − entrée) × quantité × valeur du point − frais.</p>
        <button className="btn primary" onClick={save}>Enregistrer</button>
      </section>

      <section className="card">
        <h2>Sauvegarde</h2>
        <p className="muted small">Tes données restent sur cet appareil{usage ? ` (${usage})` : ''}. Exporte régulièrement une sauvegarde : elle contient aussi les captures.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={doExport}>Exporter la sauvegarde (.json)</button>
          <label className="btn">Importer une sauvegarde<input type="file" accept="application/json,.json" hidden onChange={doImport} /></label>
          <button className="btn" onClick={doCsv}>Exporter en CSV (Excel)</button>
        </div>
      </section>

      <section className="card">
        <h2>Zone dangereuse</h2>
        <button className="btn danger" onClick={wipe}>Effacer toutes les données</button>
      </section>

      {msg && <p className="toast" role="status" onClick={() => setMsg('')}>{msg}</p>}
    </div>
  );
}
