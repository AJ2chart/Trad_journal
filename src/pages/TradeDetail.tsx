import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, deleteTrade, uid, updateTrade } from '../db';
import { sortChrono, tradeFees, tradePnl, tradeR, tradeRisk } from '../calc';
import { fmtMoney, fmtNum, fmtR, parseNum, pnlClass, useSettings } from '../format';
import { EMOTIONS, MISTAKES, type Trade } from '../types';
import ImageGallery from '../components/ImageGallery';
import { saveInstrument, useInstruments } from '../instruments';
import Icon from '../components/Icon';
import { SidePill, SymbolBadge } from '../components/ui';
import SymbolPicker from '../components/SymbolPicker';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const prettyDate = (d: string) => {
  const s = dateFmt.format(new Date(d + 'T12:00:00'));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** URL de la première capture du trade (bannière). */
function useFirstImage(tradeId: string) {
  const img = useLiveQuery(() => db.images.where('tradeId').equals(tradeId).sortBy('createdAt').then((l) => l[0] ?? null), [tradeId]);
  const url = useMemo(() => (img ? URL.createObjectURL(img.blob) : null), [img]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

export default function TradeDetail() {
  const { id = '' } = useParams();
  const trade = useLiveQuery(async () => (await db.trades.get(id)) ?? null, [id]);
  if (trade === undefined) return <div className="page"><p className="muted">Chargement…</p></div>;
  if (trade === null) return <div className="page"><p>Ce trade n’existe pas (ou plus). <Link to="/">Retour au journal</Link></p></div>;
  return <Editor key={id} initial={trade} />;
}

function Editor({ initial }: { initial: Trade }) {
  const settings = useSettings();
  const instruments = useInstruments();
  const navigate = useNavigate();
  const [t, setT] = useState<Trade>(initial);
  const pending = useRef<Partial<Trade>>({});
  const timer = useRef<number | undefined>(undefined);

  const flush = () => {
    window.clearTimeout(timer.current);
    if (Object.keys(pending.current).length) {
      void updateTrade(initial.id, pending.current);
      pending.current = {};
    }
  };
  useEffect(() => flush, []); // sauvegarde en quittant la page

  const patch = (p: Partial<Trade>, immediate = false) => {
    setT((prev) => ({ ...prev, ...p }));
    pending.current = { ...pending.current, ...p };
    window.clearTimeout(timer.current);
    if (immediate) flush();
    else timer.current = window.setTimeout(flush, 500);
  };

  const neighbours = useLiveQuery(async () => {
    const all = sortChrono(await db.trades.toArray());
    const i = all.findIndex((x) => x.id === initial.id);
    return { prev: all[i - 1]?.id, next: all[i + 1]?.id };
  }, [initial.id]);

  const banner = useFirstImage(initial.id);
  const pnl = tradePnl(t);
  const r = tradeR(t);
  const risk = tradeRisk(t);

  const toggle = (k: 'emotions' | 'mistakes', v: string) => {
    const cur = t[k] ?? [];
    patch({ [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }, true);
  };

  async function remove() {
    if (!confirm(`Supprimer le trade ${t.symbol} du ${t.date} ? (captures incluses)`)) return;
    window.clearTimeout(timer.current);
    pending.current = {};
    await deleteTrade(t.id);
    navigate('/');
  }

  return (
    <div className="page detail">
      <div className="detail-head">
        <Link to="/" className="back"><Icon name="left" size={16} /> Journal</Link>
        <div className="pager">
          <button className="icon-btn" disabled={!neighbours?.prev} onClick={() => navigate(`/trade/${neighbours!.prev}`)} aria-label="Trade précédent" title="Trade précédent"><Icon name="left" /></button>
          <button className="icon-btn" disabled={!neighbours?.next} onClick={() => navigate(`/trade/${neighbours!.next}`)} aria-label="Trade suivant" title="Trade suivant"><Icon name="right" /></button>
        </div>
      </div>

      <section className={`hero ${banner ? 'has-banner' : ''}`}>
        {banner && <div className="hero-banner" style={{ backgroundImage: `url(${banner})` }} aria-hidden />}
        <div className="hero-body">
          <div className="hero-id">
            <SymbolBadge symbol={t.symbol || '?'} size={56} />
            <div>
              <div className="hero-title"><h1>{t.symbol}</h1><SidePill side={t.side} /></div>
              <p className="muted">{prettyDate(t.date)}{t.time ? ` · ${t.time}` : ''}{t.setup ? ` · ${t.setup}` : ''}</p>
            </div>
          </div>
          <div className="hero-result">
            <span className="eyebrow">{pnl == null ? 'Position ouverte' : 'Résultat'}</span>
            <strong className={`hero-pnl mono ${pnlClass(pnl)}`}>{pnl == null ? '—' : fmtMoney(pnl, settings.currency)}</strong>
            {r != null && <span className={`r-chip big ${pnlClass(r)}`}>{fmtR(r)}</span>}
          </div>
        </div>
        <div className="hero-strip mono">
          <div><span>Entrée</span><strong>{fmtNum(t.entry)}</strong></div>
          <div><span>Sortie</span><strong>{t.exit == null ? '—' : fmtNum(t.exit)}</strong></div>
          <div><span>Quantité</span><strong>{fmtNum(t.qty)}</strong></div>
          <div><span>Stop</span><strong>{fmtNum(t.stop)}</strong></div>
          <div><span>Risque</span><strong>{risk == null ? '—' : fmtMoney(risk, settings.currency, false)}</strong></div>
          <div><span>Frais</span><strong>{fmtMoney(tradeFees(t), settings.currency, false)}</strong></div>
        </div>
      </section>

      <div className="detail-grid">
        <div className="col">
          <section className="card">
            <h2><Icon name="camera" size={17} /> Capture</h2>
            <ImageGallery tradeId={t.id} />
          </section>

          <section className="card">
            <h2><Icon name="pen" size={17} /> Raisonnement</h2>
            <label className="area">
              <span>Pourquoi ce trade ?</span>
              <textarea rows={4} value={t.reasonEntry ?? ''} onChange={(e) => patch({ reasonEntry: e.target.value })} placeholder="Contexte, signal, confluence, ce que j’attendais…" />
            </label>
            <label className="area">
              <span>Gestion et sortie</span>
              <textarea rows={3} value={t.reasonExit ?? ''} onChange={(e) => patch({ reasonExit: e.target.value })} placeholder="Pourquoi je suis sorti à ce moment-là ?" />
            </label>
            <label className="area">
              <span>Notes</span>
              <textarea rows={3} value={t.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} placeholder="Tout le reste…" />
            </label>
          </section>

          <section className="card">
            <h2><Icon name="bulb" size={17} /> Leçons</h2>
            <TradeLessons tradeId={t.id} />
          </section>
        </div>

        <div className="col">
          <section className="card">
            <h2><Icon name="shield" size={17} /> Discipline</h2>
            <h3>Plan respecté ?</h3>
            <div className="seg">
              {([[true, 'Oui'], [false, 'Non'], [null, '—']] as const).map(([v, l]) => (
                <button key={l} type="button" className={t.followedPlan === v || (v === null && t.followedPlan == null) ? 'on' : ''} onClick={() => patch({ followedPlan: v }, true)}>{l}</button>
              ))}
            </div>
            <h3>Qualité d’exécution</h3>
            <div className="stars" role="radiogroup" aria-label="Qualité d’exécution">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={t.rating === n} aria-label={`${n} sur 5`} className={(t.rating ?? 0) >= n ? 'on' : ''} onClick={() => patch({ rating: t.rating === n ? null : n }, true)}>★</button>
              ))}
            </div>
            <h3>Émotions</h3>
            <div className="chips">
              {EMOTIONS.map((e) => <button key={e} type="button" className={t.emotions?.includes(e) ? 'chip on' : 'chip'} onClick={() => toggle('emotions', e)}>{e}</button>)}
            </div>
            <h3>Erreurs</h3>
            <div className="chips">
              {MISTAKES.map((e) => <button key={e} type="button" className={t.mistakes?.includes(e) ? 'chip on warn' : 'chip'} onClick={() => toggle('mistakes', e)}>{e}</button>)}
            </div>
          </section>

          <section className="card">
            <h2><Icon name="target" size={17} /> Exécution</h2>
            <div className="fields">
              <div className="field"><span>Symbole</span><SymbolPicker value={t.symbol} onChange={(v) => patch({ symbol: v })} /></div>
              <Field label="Sens">
                <div className={`side-switch ${t.side}`} role="radiogroup" aria-label="Sens">
                  <button type="button" role="radio" aria-checked={t.side === 'long'} onClick={() => patch({ side: 'long' }, true)}>Long</button>
                  <button type="button" role="radio" aria-checked={t.side === 'short'} onClick={() => patch({ side: 'short' }, true)}>Short</button>
                  <i aria-hidden />
                </div>
              </Field>
              <Field label="Date"><input type="date" value={t.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
              <Field label="Heure"><input type="time" value={t.time ?? ''} onChange={(e) => patch({ time: e.target.value || undefined })} /></Field>
              <NumField label="Quantité" value={t.qty} onChange={(v) => v != null && patch({ qty: v })} />
              <NumField label="Entrée" value={t.entry} onChange={(v) => v != null && patch({ entry: v })} />
              <NumField label="Sortie" value={t.exit} onChange={(v) => patch({ exit: v })} placeholder="ouvert" />
              <NumField label="Stop" value={t.stop} onChange={(v) => patch({ stop: v })} />
              <NumField label="Objectif" value={t.target} onChange={(v) => patch({ target: v })} />
              <Field label="Setup"><input value={t.setup ?? ''} onChange={(e) => patch({ setup: e.target.value || undefined })} /></Field>
              <NumField label={`Frais fixes (${settings.currency})`} value={t.fees} onChange={(v) => patch({ fees: v ?? undefined })} />
              <NumField label="Frais (%)" value={t.feePct} onChange={(v) => patch({ feePct: v ?? undefined })} placeholder="ex. 0,1" />
              <NumField label="Valeur du point" value={t.multiplier ?? 1} onChange={(v) => {
                patch({ multiplier: v ?? undefined });
                // Retenu pour les prochains trades sur ce symbole.
                if (v != null && v > 0 && t.symbol) void saveInstrument(t.symbol, { multiplier: v });
              }} />
            </div>
            {instruments[t.symbol] && <p className="muted small">Valeur du point retenue pour {t.symbol} : ×{String(instruments[t.symbol].multiplier).replace('.', ',')}. Modifiable dans Réglages → Instruments.</p>}
          </section>
        </div>
      </div>

      <div className="danger-zone">
        <button className="btn danger" onClick={remove}><Icon name="trash" size={16} /> Supprimer ce trade</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','));
  return (
    <Field label={label}>
      <input inputMode="decimal" value={text} placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseNum(e.target.value);
          if (v != null || e.target.value.trim() === '') onChange(v);
        }} />
    </Field>
  );
}

function TradeLessons({ tradeId }: { tradeId: string }) {
  const linked = useLiveQuery(() => db.lessons.where('tradeIds').equals(tradeId).toArray(), [tradeId]) ?? [];
  const all = useLiveQuery(() => db.lessons.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const others = useMemo(() => all.filter((l) => !l.tradeIds.includes(tradeId)), [all, tradeId]);

  async function create() {
    if (!title.trim()) return;
    const now = Date.now();
    await db.lessons.add({ id: uid(), title: title.trim(), content: content.trim(), tradeIds: [tradeId], createdAt: now, updatedAt: now });
    setTitle('');
    setContent('');
  }
  async function link(id: string) {
    const l = await db.lessons.get(id);
    if (l) await db.lessons.update(id, { tradeIds: [...l.tradeIds, tradeId] });
  }
  async function unlink(id: string) {
    const l = await db.lessons.get(id);
    if (l) await db.lessons.update(id, { tradeIds: l.tradeIds.filter((x) => x !== tradeId) });
  }

  return (
    <div className="lessons-inline">
      {linked.length > 0 && (
        <ul className="lesson-list">
          {linked.map((l) => (
            <li key={l.id}>
              <div><strong>{l.title}</strong>{l.content && <p>{l.content}</p>}</div>
              <button className="btn ghost small" onClick={() => unlink(l.id)} title="Délier de ce trade">Délier</button>
            </li>
          ))}
        </ul>
      )}
      <div className="new-lesson">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle leçon tirée de ce trade…" onKeyDown={(e) => e.key === 'Enter' && create()} />
        <textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Détail (optionnel)" />
        <div className="row">
          <button className="btn primary" onClick={create} disabled={!title.trim()}>Ajouter la leçon</button>
          {others.length > 0 && (
            <select value="" onChange={(e) => e.target.value && link(e.target.value)} aria-label="Lier une leçon existante">
              <option value="">Lier une leçon existante…</option>
              {others.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
