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

export default function App() {
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
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nouveau trade">
            <div className="sheet-grip" />
            <QuickAdd variant="sheet" autoFocus onDone={() => setSheet(false)} />
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
