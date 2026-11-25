import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Journal from './pages/Journal';
import TradeDetail from './pages/TradeDetail';
import Stats from './pages/Stats';
import Lessons from './pages/Lessons';
import SettingsPage from './pages/Settings';
import Icon, { type IconName } from './components/Icon';
import QuickAdd from './components/QuickAdd';
import { CountUp, Toaster } from './components/ui';
import { db } from './db';
import { tradePnl } from './calc';
import { fmtMoney, pnlClass, today, useSettings } from './format';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Journal', icon: 'journal' },
  { to: '/stats', label: 'Stats', icon: 'stats' },
  { to: '/lecons', label: 'Leçons', icon: 'lessons' },
  { to: '/reglages', label: 'Réglages', icon: 'settings' },
];

function TodayCard() {
  const { currency } = useSettings();
  const t = today();
  const trades = useLiveQuery(() => db.trades.where('date').equals(t).toArray(), [t]) ?? [];
  const pnl = trades.reduce((s, x) => s + (tradePnl(x) ?? 0), 0);
  return (
    <div className="today-card">
      <span className="eyebrow">Aujourd’hui</span>
      <strong className={`mono ${pnlClass(pnl)}`}><CountUp value={pnl} format={(v) => fmtMoney(v, currency)} /></strong>
      <span className="muted small">{trades.length} trade{trades.length > 1 ? 's' : ''}</span>
    </div>
  );
}

/**
 * Suit le clavier virtuel : expose sa hauteur (--kb) et la hauteur visible (--vvh),
 * et ajoute .kb-open sur <html> pour masquer la barre du bas pendant la saisie.
 */
function useKeyboardInsets() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kb', `${kb}px`);
      root.style.setProperty('--vvh', `${vv.height}px`);
      const focused = document.activeElement?.matches('input, textarea, select');
      root.classList.toggle('kb-open', kb > 120 || (!!focused && window.innerHeight < screen.height * 0.6));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    const later = () => setTimeout(update, 50);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', later);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', later);
    };
  }, []);
}

export default function App() {
  useKeyboardInsets();
  const [sheet, setSheet] = useState(false);
  const loc = useLocation();
  useEffect(() => { setSheet(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [sheet]);

  return (
    <div className="app">
      <div className="backdrop" aria-hidden />
      <aside className="sidebar">
        <div className="brand">
          <img src="./icon.svg" alt="" width={30} height={30} />
          <div>
            <strong>Trad Journal</strong>
            <span>Carnet de trading</span>
          </div>
        </div>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="side-link">
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <TodayCard />
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Journal />} />
          <Route path="/trade/:id" element={<TradeDetail />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/lecons" element={<Lessons />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="tabbar">
        {NAV.slice(0, 2).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="tab"><Icon name={n.icon} size={21} /><span>{n.label}</span></NavLink>
        ))}
        <button className="fab" onClick={() => setSheet(true)} aria-label="Ajouter un trade"><Icon name="plus" size={26} stroke={2.4} /></button>
        {NAV.slice(2).map((n) => (
          <NavLink key={n.to} to={n.to} className="tab"><Icon name={n.icon} size={21} /><span>{n.label}</span></NavLink>
        ))}
      </nav>

      {sheet && (
        <div className="sheet-wrap" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nouveau trade"
            onFocusCapture={(e) => {
              // Garde le champ actif visible au-dessus du clavier.
              const el = e.target as HTMLElement;
              setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 250);
            }}>
            <div className="sheet-grip" />
            <QuickAdd variant="sheet" autoFocus onDone={() => setSheet(false)} />
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
