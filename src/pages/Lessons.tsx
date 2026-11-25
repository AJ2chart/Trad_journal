import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, uid } from '../db';
import { tradePnl } from '../calc';
import { fmtDate, fmtMoney, pnlClass, useSettings } from '../format';
import type { Lesson, Trade } from '../types';
import Icon from '../components/Icon';

export default function Lessons() {
  const { currency } = useSettings();
  const lessons = useLiveQuery(() => db.lessons.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? [];
  const byId = useMemo(() => new Map(trades.map((t) => [t.id, t])), [trades]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newCat, setNewCat] = useState('');

  const categories = useMemo(() => [...new Set(lessons.map((l) => l.category).filter(Boolean) as string[])].sort(), [lessons]);
  const shown = lessons.filter((l) =>
    (!cat || l.category === cat) &&
    (!q || `${l.title} ${l.content} ${l.category ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  );

  async function create() {
    if (!title.trim()) return;
    const now = Date.now();
    await db.lessons.add({ id: uid(), title: title.trim(), content: content.trim(), category: newCat.trim() || undefined, tradeIds: [], createdAt: now, updatedAt: now });
    setTitle(''); setContent('');
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Leçons</span>
          <h1>Ce que le marché <span className="grad-text">t’a appris.</span></h1>
        </div>
      </header>
      <section className="card">
        <h2><Icon name="sparkle" size={17} /> Nouvelle leçon</h2>
        <div className="new-lesson">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Ne jamais déplacer mon stop" onKeyDown={(e) => e.key === 'Enter' && create()} />
          <textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Pourquoi, et comment l’appliquer" />
          <div className="row">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Catégorie (Gestion, Psychologie…)" list="lesson-cats" />
            <button className="btn primary" onClick={create} disabled={!title.trim()}>Ajouter</button>
          </div>
          <datalist id="lesson-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <p className="muted small">Astuce : depuis le détail d’un trade, tu peux créer une leçon déjà liée à ce trade.</p>
      </section>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Rechercher une leçon" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {categories.length > 0 && (
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
            <option value="">Toutes catégories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state glass"><div className="empty-ico"><Icon name="bulb" size={28} /></div><h2>{lessons.length ? 'Aucune leçon ne correspond' : 'Pas encore de leçon'}</h2><p className="muted">{lessons.length ? 'Essaie un autre mot-clé.' : 'Chaque trade a quelque chose à t’apprendre. Note-le ici ou depuis le détail d’un trade.'}</p></div>
      ) : (
        <div className="lesson-cards">
          {shown.map((l) => <LessonCard key={l.id} lesson={l} trades={l.tradeIds.map((id) => byId.get(id)).filter(Boolean) as Trade[]} currency={currency} categories={categories} />)}
        </div>
      )}
    </div>
  );
}

function LessonCard({ lesson, trades, currency, categories }: { lesson: Lesson; trades: Trade[]; currency: string; categories: string[] }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ title: lesson.title, content: lesson.content, category: lesson.category ?? '' });
  const total = trades.reduce((s, t) => s + (tradePnl(t) ?? 0), 0);

  async function save() {
    await db.lessons.update(lesson.id, { title: d.title.trim() || lesson.title, content: d.content, category: d.category.trim() || undefined, updatedAt: Date.now() });
    setEdit(false);
  }

  return (
    <article className="card lesson-card">
      {edit ? (
        <div className="new-lesson">
          <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <textarea rows={4} value={d.content} onChange={(e) => setD({ ...d, content: e.target.value })} />
          <input value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} placeholder="Catégorie" list="lesson-cats" />
          <datalist id="lesson-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="row">
            <button className="btn primary" onClick={save}>Enregistrer</button>
            <button className="btn ghost" onClick={() => setEdit(false)}>Annuler</button>
            <button className="btn danger" onClick={() => confirm('Supprimer cette leçon ?') && db.lessons.delete(lesson.id)}>Supprimer</button>
          </div>
        </div>
      ) : (
        <>
          <header>
            <h3>{lesson.title}</h3>
            <button className="btn ghost small" onClick={() => setEdit(true)}>Modifier</button>
          </header>
          {lesson.category && <span className="pill">{lesson.category}</span>}
          {lesson.content && <p className="lesson-body">{lesson.content}</p>}
        </>
      )}
      {trades.length > 0 && (
        <div className="lesson-trades">
          <div className="muted small">{trades.length} trade{trades.length > 1 ? 's' : ''} lié{trades.length > 1 ? 's' : ''} · <span className={pnlClass(total)}>{fmtMoney(total, currency)}</span></div>
          <ul>
            {trades.map((t) => {
              const p = tradePnl(t);
              return <li key={t.id}><Link to={`/trade/${t.id}`}>{fmtDate(t.date)} · {t.symbol}</Link><span className={pnlClass(p)}>{p == null ? 'ouvert' : fmtMoney(p, currency)}</span></li>;
            })}
          </ul>
        </div>
      )}
    </article>
  );
}
